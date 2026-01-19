import * as vscode from 'vscode';
import * as path from 'path';
import { SearchMode, UIStateDTO, TogglePreferences, SearchResultDTO } from '../core/types';
import { ExtensionMessage, WebviewMessage, MessageHandler } from './messageProtocol';
import { getConfig, onConfigChange, onColorThemeChange } from '../config/settings';

const TOGGLE_PREFS_KEY = 'polaris.togglePreferences';

export class PolarisPanel {
  public static currentPanels: Map<string, PolarisPanel> = new Map();
  private static panelIdCounter = 0;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private readonly panelId: string;
  private readonly mode: SearchMode;
  private disposables: vscode.Disposable[] = [];
  private uiState: UIStateDTO;
  private lastQuery: string = '';
  private lastIncludeGlobs: string[] = [];
  private lastExcludeGlobs: string[] = [];
  private lastSearchResults: SearchResultDTO[] = [];

  public static createOrShow(
    context: vscode.ExtensionContext,
    mode: SearchMode
  ): PolarisPanel {
    const panelId = `polaris-${++PolarisPanel.panelIdCounter}`;
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const panel = vscode.window.createWebviewPanel(
      'polaris',
      mode === 'findFiles' ? 'Find Files' : mode === 'findInOpenFiles' ? 'Find in Open Files' : 'Find in Files',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(context.extensionUri, 'webview'),
          vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
          vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'file-icons-js', 'css'),
          vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'file-icons-js', 'fonts'),
        ],
      }
    );

    const polarisPanel = new PolarisPanel(panel, context, panelId, mode);
    PolarisPanel.currentPanels.set(panelId, polarisPanel);

    return polarisPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    panelId: string,
    mode: SearchMode
  ) {
    this.panel = panel;
    this.context = context;
    this.extensionUri = context.extensionUri;
    this.panelId = panelId;
    this.mode = mode;

    const savedPrefs = this.context.globalState.get<TogglePreferences>(TOGGLE_PREFS_KEY);

    this.uiState = {
      mode: this.mode,
      busy: false,
      matchCase: savedPrefs?.matchCase ?? false,
      matchWholeWord: savedPrefs?.matchWholeWord ?? false,
      useRegex: savedPrefs?.useRegex ?? false,
      liveSearch: savedPrefs?.liveSearch ?? true,
      showReplace: false,
    };

    this.panel.webview.html = this.getHtmlForWebview();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        this.handleMessage(message);
      },
      null,
      this.disposables
    );

    this.panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.active) {
          this.postMessage({ type: 'focusSearchInput' });
        }
      },
      null,
      this.disposables
    );

    const configDisposable = onConfigChange(() => {
      this.postMessage({
        type: 'setConfig',
        config: getConfig(),
      });
    });
    this.disposables.push(configDisposable);

    const colorThemeDisposable = onColorThemeChange(() => {
      this.postMessage({
        type: 'setConfig',
        config: getConfig(),
      });
    });
    this.disposables.push(colorThemeDisposable);
  }

  public postMessage(message: ExtensionMessage): void {
    this.panel.webview.postMessage(message);
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.postMessage({ type: 'setUIState', state: this.uiState });
        this.postMessage({ type: 'setConfig', config: getConfig() });
        break;
      case 'queryChanged':
        this.handleQueryChanged(message.query, message.includeGlobs, message.excludeGlobs);
        break;
      case 'resultSelected':
        this.handleResultSelected(message.path, message.line);
        break;
      case 'searchResultSelected':
        this.handleResultSelected(message.path, message.line);
        break;
      case 'openFile':
        this.handleOpenFile(message.path, message.line, message.mode);
        break;
      case 'modeChanged':
        this.uiState.mode = message.mode;
        this.updatePanelTitle();
        this.sendUIState();
        this.rerunSearch();
        break;
      case 'toggleMatchCase':
        this.uiState.matchCase = !this.uiState.matchCase;
        this.sendUIState();
        this.saveTogglePreferences();
        this.rerunSearch();
        break;
      case 'toggleMatchWholeWord':
        this.uiState.matchWholeWord = !this.uiState.matchWholeWord;
        this.sendUIState();
        this.saveTogglePreferences();
        this.rerunSearch();
        break;
      case 'toggleUseRegex':
        this.uiState.useRegex = !this.uiState.useRegex;
        this.sendUIState();
        this.saveTogglePreferences();
        this.rerunSearch();
        break;
      case 'toggleLiveSearch':
        this.uiState.liveSearch = !this.uiState.liveSearch;
        this.sendUIState();
        this.saveTogglePreferences();
        break;
      case 'toggleReplace':
        this.uiState.showReplace = !this.uiState.showReplace;
        this.sendUIState();
        break;
      case 'replaceOne':
        await this.handleReplaceOne(
          message.path,
          message.line,
          message.column,
          message.matchLength,
          message.replaceText
        );
        break;
      case 'replaceAll':
        await this.handleReplaceAll(message.replaceText);
        break;
    }
  }

  private sendUIState(): void {
    this.postMessage({ type: 'setUIState', state: this.uiState });
  }

  private async saveTogglePreferences(): Promise<void> {
    const prefs: TogglePreferences = {
      matchCase: this.uiState.matchCase,
      matchWholeWord: this.uiState.matchWholeWord,
      useRegex: this.uiState.useRegex,
      liveSearch: this.uiState.liveSearch,
    };

    await this.context.globalState.update(TOGGLE_PREFS_KEY, prefs);
  }

  private updatePanelTitle(): void {
    if (this.uiState.mode === 'findFiles') {
      this.panel.title = 'Find Files';
    } else if (this.uiState.mode === 'findInOpenFiles') {
      this.panel.title = 'Find in Open Files';
    } else {
      this.panel.title = 'Find in Files';
    }
  }

  private getOpenFilePaths(): string[] {
    const openFiles: string[] = [];
    const workspaceRoot = this.getWorkspaceRoot();
    
    if (!workspaceRoot) {
      return openFiles;
    }

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.input instanceof vscode.TabInputText) {
          const uri = tab.input.uri;
          
          if (uri.scheme === 'file' && uri.fsPath.startsWith(workspaceRoot)) {
            const relativePath = uri.fsPath.substring(workspaceRoot.length + 1);
            openFiles.push(relativePath);
          }
        }
      }
    }
    
    return openFiles;
  }

  private rerunSearch(): void {
    if (this.lastQuery.trim()) {
      this.handleQueryChanged(this.lastQuery, this.lastIncludeGlobs, this.lastExcludeGlobs);
    }
  }

  private async handleQueryChanged(query: string, includeGlobs?: string[], excludeGlobs?: string[]): Promise<void> {
    this.lastQuery = query;
    this.lastIncludeGlobs = includeGlobs || [];
    this.lastExcludeGlobs = excludeGlobs || [];

    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    this.postMessage({ type: 'setBusy', busy: true });

    try {
      if (this.uiState.mode === 'findFiles') {
        const { findFiles } = await import('../finders/fileFinder');
        const results = await findFiles(query, workspaceRoot, {
          matchCase: this.uiState.matchCase,
          matchWholeWord: this.uiState.matchWholeWord,
          useRegex: this.uiState.useRegex,
        });
        
        this.postMessage({
          type: 'setFileResults',
          results
        });
      } else if (this.uiState.mode === 'findInOpenFiles') {
        const openFilePaths = this.getOpenFilePaths();
        
        if (openFilePaths.length === 0) {
          this.postMessage({ type: 'setBusy', busy: false });
          this.lastSearchResults = [];
          this.postMessage({
            type: 'setSearchResults',
            results: [],
            totalCount: 0,
          });
          return;
        }
        
        const { findInFiles } = await import('../finders/contentFinder');
        const results = await findInFiles({
          query,
          workspaceRoot,
          matchCase: this.uiState.matchCase,
          matchWholeWord: this.uiState.matchWholeWord,
          useRegex: this.uiState.useRegex,
          filePaths: openFilePaths,
        });
        
        this.lastSearchResults = results;
        
        this.postMessage({
          type: 'setSearchResults',
          results,
          totalCount: results.length,
        });
      } else {
        const { findInFiles } = await import('../finders/contentFinder');
        const results = await findInFiles({
          query,
          workspaceRoot,
          matchCase: this.uiState.matchCase,
          matchWholeWord: this.uiState.matchWholeWord,
          useRegex: this.uiState.useRegex,
          includeGlobs: includeGlobs || [],
          excludeGlobs: excludeGlobs || [],
        });
        
        this.lastSearchResults = results;
        
        this.postMessage({
          type: 'setSearchResults',
          results,
          totalCount: results.length,
        });
      }
    } catch (error) {
      console.error('Error during search:', error);
    } finally {
      this.postMessage({ type: 'setBusy', busy: false });
    }
  }

  private async handleResultSelected(filePath: string, line?: number): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    try {
      const { readFilePreview } = await import('../adapters/workspace/fileSystem');
      
      const isContentSearch = this.uiState.mode === 'findInFiles';
      const searchTerm = isContentSearch ? this.lastQuery : undefined;
      const searchOptions = isContentSearch ? {
        matchCase: this.uiState.matchCase,
        useRegex: this.uiState.useRegex,
        matchWholeWord: this.uiState.matchWholeWord
      } : undefined;
      
      const preview = await readFilePreview(
        workspaceRoot, 
        filePath, 
        line,
        searchTerm,
        searchOptions
      );
      
      this.postMessage({
        type: 'setPreview',
        preview
      });
    } catch (error) {
      console.error('Error reading file preview:', error);
    }
  }

  private getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
  }

  private async handleOpenFile(
    filePath: string,
    line?: number,
    mode: 'current' | 'split' | 'tab' = 'current'
  ): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    const absolutePath = path.join(workspaceRoot, filePath);
    const uri = vscode.Uri.file(absolutePath);
    const doc = await vscode.workspace.openTextDocument(uri);

    let viewColumn = vscode.ViewColumn.One;
    if (mode === 'split') {
      viewColumn = vscode.ViewColumn.Beside;
    } else if (mode === 'tab') {
      viewColumn = vscode.ViewColumn.Active;
    }

    const editor = await vscode.window.showTextDocument(doc, viewColumn);

    if (line !== undefined && line > 0) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    }
  }

  private async checkAndRefreshStaleFile(
    filePath: string,
    expectedMtime: number
  ): Promise<SearchResultDTO | null> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return null;

    const absolutePath = path.join(workspaceRoot, filePath);
    
    try {
      const stats = await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
      
      if (stats.mtime !== expectedMtime) {
        const { findInFiles } = await import('../finders/contentFinder');
        const results = await findInFiles({
          query: this.lastQuery,
          workspaceRoot,
          matchCase: this.uiState.matchCase,
          matchWholeWord: this.uiState.matchWholeWord,
          useRegex: this.uiState.useRegex,
          includeGlobs: [filePath],
          excludeGlobs: [],
        });
        
        return results.length > 0 ? results[0] : null;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async replaceInFile(
    uri: vscode.Uri,
    replacements: Array<{ line: number; column: number; length: number; replaceText: string }>
  ): Promise<{ success: boolean; error?: string }> {
    const openDoc = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === uri.toString()
    );
    
    if (openDoc) {
      const edit = new vscode.WorkspaceEdit();
      const sorted = [...replacements].sort((a, b) => b.line - a.line || b.column - a.column);
      for (const r of sorted) {
        const range = new vscode.Range(
          new vscode.Position(r.line - 1, r.column),
          new vscode.Position(r.line - 1, r.column + r.length)
        );
        edit.replace(uri, range, r.replaceText);
      }
      const success = await vscode.workspace.applyEdit(edit);
      if (success) {
        try {
          await openDoc.save();
        } catch (error) {
          return { success: false, error: String(error) };
        }
      }
      return { success };
    } else {
      try {
        const content = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(content);
        const lines = text.split('\n');
        
        const sorted = [...replacements].sort((a, b) => b.line - a.line || b.column - a.column);
        for (const r of sorted) {
          const lineIdx = r.line - 1;
          if (lineIdx >= 0 && lineIdx < lines.length) {
            const line = lines[lineIdx];
            lines[lineIdx] = line.slice(0, r.column) + r.replaceText + line.slice(r.column + r.length);
          }
        }
        
        const newContent = new TextEncoder().encode(lines.join('\n'));
        await vscode.workspace.fs.writeFile(uri, newContent);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  }

  private async handleReplaceOne(
    filePath: string,
    line: number,
    column: number,
    matchLength: number,
    replaceText: string
  ): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return;

    const searchResult = this.lastSearchResults.find(r => r.path === filePath && r.line === line);
    if (!searchResult) {
      vscode.window.showWarningMessage(`Could not find search result for ${filePath}:${line}`);
      return;
    }

    const refreshed = await this.checkAndRefreshStaleFile(filePath, searchResult.mtime);
    
    if (refreshed) {
      const match = refreshed.matches.find(m => m.column === column);
      if (match) {
        line = refreshed.line;
        column = match.column;
        matchLength = match.matchText.length;
      } else {
        vscode.window.showWarningMessage(`Match no longer exists in ${filePath}`);
        this.rerunSearch();
        return;
      }
    }

    const absolutePath = path.join(workspaceRoot, filePath);
    const uri = vscode.Uri.file(absolutePath);

    const result = await this.replaceInFile(uri, [{
      line,
      column,
      length: matchLength,
      replaceText
    }]);

    if (result.success) {
      this.rerunSearch();
    } else if (result.error) {
      vscode.window.showWarningMessage(`Failed to replace in ${filePath}: ${result.error}`);
    }

    this.postMessage({
      type: 'replaceComplete',
      result: { success: result.success, replacedCount: result.success ? 1 : 0 }
    });
  }

  private async handleReplaceAll(replaceText: string): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return;

    if (this.lastSearchResults.length === 0) {
      vscode.window.showInformationMessage('No search results to replace');
      return;
    }

    const totalMatches = this.lastSearchResults.reduce((sum, result) => sum + result.matches.length, 0);
    const fileCount = new Set(this.lastSearchResults.map(r => r.path)).size;

    const confirm = await vscode.window.showWarningMessage(
      `Replace ${totalMatches} occurrences in ${fileCount} file(s)?`,
      { modal: true },
      'Replace'
    );

    if (confirm !== 'Replace') return;

    const replacementsByFile = new Map<string, {
      replacements: Array<{ line: number; column: number; length: number; replaceText: string }>;
      mtime: number;
    }>();

    for (const result of this.lastSearchResults) {
      let fileData = replacementsByFile.get(result.path);
      if (!fileData) {
        fileData = { replacements: [], mtime: result.mtime };
        replacementsByFile.set(result.path, fileData);
      }
      
      for (const match of result.matches) {
        fileData.replacements.push({
          line: result.line,
          column: match.column,
          length: match.matchText.length,
          replaceText
        });
      }
    }

    const failedFiles: string[] = [];
    let successCount = 0;

    for (const [filePath, fileData] of replacementsByFile) {
      const refreshed = await this.checkAndRefreshStaleFile(filePath, fileData.mtime);
      
      let replacements = fileData.replacements;
      
      if (refreshed) {
        replacements = refreshed.matches.map(match => ({
          line: refreshed.line,
          column: match.column,
          length: match.matchText.length,
          replaceText
        }));
      }
      
      const uri = vscode.Uri.file(path.join(workspaceRoot, filePath));
      const result = await this.replaceInFile(uri, replacements);
      if (result.success) {
        successCount += replacements.length;
      } else {
        failedFiles.push(filePath);
      }
    }

    const success = successCount > 0;

    if (success) {
      this.rerunSearch();
      vscode.window.showInformationMessage(
        `Replaced ${successCount} occurrences in ${fileCount - failedFiles.length} file(s)`
      );

      if (failedFiles.length > 0) {
        vscode.window.showWarningMessage(
          `Failed to replace in ${failedFiles.length} file(s): ${failedFiles.map(f => path.basename(f)).join(', ')}`
        );
      }
    } else {
      vscode.window.showErrorMessage('Failed to apply replacements');
    }

    this.postMessage({
      type: 'replaceComplete',
      result: { 
        success, 
        replacedCount: successCount,
        failedFiles: failedFiles.length > 0 ? failedFiles : undefined
      }
    });
  }

  private getHtmlForWebview(): string {
    const webview = this.panel.webview;

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );

    const baseCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'styles', 'base.css')
    );

    const componentsCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'styles', 'components.css')
    );

    const codiconCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
    );

    const fileIconsCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'file-icons-js', 'css', 'style.css')
    );

    const fontAwesomeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'file-icons-js', 'fonts', 'fontawesome.woff2')
    );
    const mfizzUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'file-icons-js', 'fonts', 'mfixx.woff2')
    );
    const deviconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'file-icons-js', 'fonts', 'devopicons.woff2')
    );
    const fileIconsFontUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'file-icons-js', 'fonts', 'file-icons.woff2')
    );
    const octiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'file-icons-js', 'fonts', 'octicons.woff2')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}' 'wasm-unsafe-eval';">
  <style>
    @font-face { font-family: FontAwesome; src: url("${fontAwesomeUri}"); }
    @font-face { font-family: Mfizz; src: url("${mfizzUri}"); }
    @font-face { font-family: Devicons; src: url("${deviconsUri}"); }
    @font-face { font-family: file-icons; src: url("${fileIconsFontUri}"); }
    @font-face { font-family: octicons; src: url("${octiconsUri}"); }
  </style>
  <link rel="stylesheet" href="${codiconCssUri}">
  <link rel="stylesheet" href="${fileIconsCssUri}">
  <link rel="stylesheet" href="${baseCssUri}">
  <link rel="stylesheet" href="${componentsCssUri}">
  <title>Polaris Search</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    PolarisPanel.currentPanels.delete(this.panelId);

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
