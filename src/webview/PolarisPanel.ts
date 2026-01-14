import * as vscode from 'vscode';
import * as path from 'path';
import { SearchMode, UIStateDTO } from '../core/types';
import { ExtensionMessage, WebviewMessage, MessageHandler } from './messageProtocol';
import { getConfig, onConfigChange } from '../config/settings';

export class PolarisPanel {
  public static currentPanels: Map<string, PolarisPanel> = new Map();
  private static panelIdCounter = 0;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly panelId: string;
  private readonly mode: SearchMode;
  private disposables: vscode.Disposable[] = [];
  private uiState: UIStateDTO;
  private lastQuery: string = '';
  private lastIncludeGlobs: string[] = [];
  private lastExcludeGlobs: string[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    mode: SearchMode
  ): PolarisPanel {
    const panelId = `polaris-${++PolarisPanel.panelIdCounter}`;
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const panel = vscode.window.createWebviewPanel(
      'polaris',
      mode === 'findFiles' ? 'Find Files' : 'Find in Files',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'webview'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', 'file-icons-js', 'css'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', 'file-icons-js', 'fonts'),
        ],
      }
    );

    const polarisPanel = new PolarisPanel(panel, extensionUri, panelId, mode);
    PolarisPanel.currentPanels.set(panelId, polarisPanel);

    return polarisPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    panelId: string,
    mode: SearchMode
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panelId = panelId;
    this.mode = mode;

    this.uiState = {
      mode: this.mode,
      busy: false,
      matchCase: false,
      matchWholeWord: false,
      useRegex: false,
      liveSearch: true,
      showReplace: false,
      showSearchDetails: false,
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

    this.postMessage({
      type: 'setConfig',
      config: getConfig(),
    });
  }

  public postMessage(message: ExtensionMessage): void {
    this.panel.webview.postMessage(message);
  }

  private handleMessage(message: WebviewMessage): void {
    switch (message.type) {
      case 'ready':
        this.postMessage({ type: 'setUIState', state: this.uiState });
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
        this.rerunSearch();
        break;
      case 'toggleMatchWholeWord':
        this.uiState.matchWholeWord = !this.uiState.matchWholeWord;
        this.sendUIState();
        this.rerunSearch();
        break;
      case 'toggleUseRegex':
        this.uiState.useRegex = !this.uiState.useRegex;
        this.sendUIState();
        this.rerunSearch();
        break;
      case 'toggleLiveSearch':
        this.uiState.liveSearch = !this.uiState.liveSearch;
        this.sendUIState();
        break;
      case 'toggleReplace':
        this.uiState.showReplace = !this.uiState.showReplace;
        this.sendUIState();
        break;
      case 'toggleSearchDetails':
        this.uiState.showSearchDetails = !this.uiState.showSearchDetails;
        this.sendUIState();
        break;
      case 'replaceOne':
      case 'replaceAll':
        break;
    }
  }

  private sendUIState(): void {
    this.postMessage({ type: 'setUIState', state: this.uiState });
  }

  private updatePanelTitle(): void {
    this.panel.title = this.uiState.mode === 'findFiles' ? 'Find Files' : 'Find in Files';
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
      const preview = await readFilePreview(workspaceRoot, filePath, line);
      
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
