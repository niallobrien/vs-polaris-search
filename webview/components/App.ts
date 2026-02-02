import { SearchInput } from "./SearchInput";
import { SearchOptions } from "./SearchOptions";
import { ReplaceInput } from "./ReplaceInput";
import { ResultsList } from "./ResultsList";
import { PreviewPane } from "./PreviewPane";
import {
  FileResultDTO,
  PreviewDTO,
  ConfigDTO,
  UIStateDTO,
  SearchResultDTO,
} from "../../src/core/types";
import { vscode } from "../services/vscode";
import { highlighter } from "../services/highlighter";

export class App {
  private container: HTMLElement | null = null;

  private searchInput: SearchInput;
  private searchOptions: SearchOptions;
  private replaceInput: ReplaceInput;
  private resultsList: ResultsList;
  private previewPane: PreviewPane;
  private uiState: UIStateDTO | null = null;
  private currentIncludeGlobs: string[] = [];
  private currentExcludeGlobs: string[] = [];
  private hasSearched: boolean = false;
  private currentPreviewData: PreviewDTO | null = null;
  private themeKind: "light" | "dark" = "dark";
  private busyTimer: number | null = null;
  private busyFrame = 0;
  private readonly busyFrames = [
    "Searching",
    "Searching.",
    "Searching..",
    "Searching...",
  ];
  private isBusy = false;
  private currentSearchId: number | null = null;
  private errorCount = 0;

  constructor() {
    this.searchInput = new SearchInput();
    this.searchOptions = new SearchOptions();
    this.replaceInput = new ReplaceInput();
    this.resultsList = new ResultsList();
    this.previewPane = new PreviewPane();
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.runGuarded("mount", () => this.render());
  }

  setFileResults(results: FileResultDTO[]): void {
    this.runGuarded("setFileResults", () => {
      this.hasSearched = true;
      this.resultsList.setResults(results);
      this.updateResultSummary(`${results.length} files`);

      if (results.length === 0) {
        this.previewPane.clear();
      }
    });
  }

  setSearchResults(results: SearchResultDTO[], totalCount: number): void {
    this.runGuarded("setSearchResults", () => {
      this.hasSearched = true;
      this.resultsList.setSearchResults(results);
      const fileCount = new Set(results.map((r) => r.path)).size;
      this.updateResultSummary(`${totalCount} matches in ${fileCount}+ files`);

      if (results.length === 0) {
        this.previewPane.clear();
      }
    });
  }

  async setPreview(preview: PreviewDTO): Promise<void> {
    await this.runGuardedAsync("setPreview", async () => {
      this.currentPreviewData = preview;
      await this.previewPane.setPreview(preview);
    });
  }

  async setConfig(config: ConfigDTO): Promise<void> {
    await this.runGuardedAsync("setConfig", async () => {
      console.log(
        "[Polaris Webview] setConfig called with theme:",
        config.theme,
        "themeKind:",
        config.themeKind,
      );
      this.searchInput.setDebounceDelay(config.liveSearchDelay);

      this.themeKind = config.themeKind;
      this.previewPane.setConfig(config);

      const previousTheme = highlighter.getTheme();
      console.log(
        "[Polaris Webview] previousTheme:",
        previousTheme,
        "newTheme:",
        config.theme,
      );

      try {
        await highlighter.setTheme(config.theme);

        // Apply theme's background color to the preview pane container
        const previewPaneContainer = document.getElementById("preview-pane");
        if (previewPaneContainer) {
          const bgColor = highlighter.getThemeBackgroundColor();
          if (bgColor) {
            previewPaneContainer.style.backgroundColor = bgColor;
            console.log("[Polaris Webview] Applied background color:", bgColor);
          } else {
            // Fallback to VS Code editor background color
            previewPaneContainer.style.backgroundColor = "";
            console.log(
              "[Polaris Webview] Using VS Code editor background color",
            );
          }
        }

        if (previousTheme !== config.theme && this.currentPreviewData) {
          await this.previewPane.setPreview(this.currentPreviewData);
        }
      } catch (error) {
        console.error("Failed to apply theme:", config.theme, error);
      }
    });
  }

  setBusy(busy: boolean, searchId: number): void {
    this.runGuarded("setBusy", () => {
      if (busy) {
        this.isBusy = true;
        this.currentSearchId = searchId;
        this.hasSearched = true;
        this.startBusyAnimation();
        return;
      }

      if (this.currentSearchId !== searchId) {
        return;
      }

      this.isBusy = false;
      this.stopBusyAnimation();
      this.currentSearchId = null;
    });
  }

  setSearchCancelled(searchId: number): void {
    this.runGuarded("setSearchCancelled", () => {
      if (!this.isBusy || this.currentSearchId !== searchId) {
        return;
      }

      this.isBusy = false;
      this.hasSearched = true;
      this.stopBusyAnimation();
      this.updateResultSummary("Cancelled search");
      this.currentSearchId = null;
    });
  }

  setSearchTimedOut(searchId: number): void {
    this.runGuarded("setSearchTimedOut", () => {
      if (!this.isBusy || this.currentSearchId !== searchId) {
        return;
      }

      this.isBusy = false;
      this.hasSearched = true;
      this.stopBusyAnimation();
      this.updateResultSummary("Search timed out");
      this.currentSearchId = null;
    });
  }

  focusSearchInput(): void {
    this.runGuarded("focusSearchInput", () => this.searchInput.focus());
  }

  setUIState(state: UIStateDTO): void {
    this.runGuarded("setUIState", () => {
      this.uiState = state;

      this.searchInput.setMode(state.mode);
      this.resultsList.setSearchMode(state.mode);
      this.searchOptions.setState({
        matchCase: state.matchCase,
        matchWholeWord: state.matchWholeWord,
        useRegex: state.useRegex,
        liveSearch: state.liveSearch,
        mode: state.mode,
        showReplace: state.showReplace,
      });

      this.searchInput.setLiveSearch(state.liveSearch);

      this.replaceInput.setVisible(
        state.showReplace && state.mode !== "findFiles",
      );

      this.updateResultsDisplay(state.mode);

      this.previewPane.clear();

      this.hasSearched = false;
      this.updateResultSummary("");
    });
  }

  setSearchHistory(history: string[]): void {
    this.runGuarded("setSearchHistory", () => {
      this.searchInput.setHistory(history);
    });
  }

  private updateResultsDisplay(
    mode: "findFiles" | "findInFiles" | "findInOpenFiles",
  ): void {
    const resultsContainer = document.getElementById("results-list");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";
    this.resultsList.mount(resultsContainer);
  }

  private updateResultSummary(text: string): void {
    const summaryEl = document.getElementById("result-summary");
    if (summaryEl) {
      if (!this.hasSearched && text !== "Searching...") {
        summaryEl.textContent = "";
      } else {
        summaryEl.textContent = text;
      }
    }
  }


  private startBusyAnimation(): void {
    if (this.busyTimer !== null) {
      return;
    }

    this.busyFrame = 0;
    this.updateResultSummary(this.busyFrames[this.busyFrame]);

    this.busyTimer = window.setInterval(() => {
      this.busyFrame = (this.busyFrame + 1) % this.busyFrames.length;
      this.updateResultSummary(this.busyFrames[this.busyFrame]);
    }, 450);
  }

  private stopBusyAnimation(): void {
    if (this.busyTimer === null) {
      return;
    }

    window.clearInterval(this.busyTimer);
    this.busyTimer = null;
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="polaris-search-app">
        <div class="polaris-search-header">
          <div class="search-row">
            <div id="search-input"></div>
            <div id="search-options"></div>
          </div>
          <div id="replace-input"></div>
          <div id="result-summary" class="result-summary"></div>
        </div>
        <div class="polaris-search-content">
          <div class="polaris-search-results" id="results-list"></div>
          <div class="polaris-search-preview" id="preview-pane"></div>
        </div>
      </div>
    `;

    const searchInputEl = this.container.querySelector("#search-input");
    const searchOptionsEl = this.container.querySelector("#search-options");
    const replaceInputEl = this.container.querySelector("#replace-input");
    const resultsListEl = this.container.querySelector("#results-list");
    const previewPaneEl = this.container.querySelector("#preview-pane");

    if (searchInputEl) {
      this.searchInput.mount(searchInputEl as HTMLElement);
      this.searchInput.setExtraParamsProvider(() => ({
        includeGlobs: this.currentIncludeGlobs,
        excludeGlobs: this.currentExcludeGlobs,
      }));
    }
    if (searchOptionsEl)
      this.searchOptions.mount(searchOptionsEl as HTMLElement);
    if (replaceInputEl) {
      this.replaceInput.mount(replaceInputEl as HTMLElement);
      this.replaceInput.setCallbacks({
        onReplace: () => this.handleReplaceOne(),
        onReplaceAll: () => this.handleReplaceAll(),
      });
    }
    if (resultsListEl) this.resultsList.mount(resultsListEl as HTMLElement);
    if (previewPaneEl) this.previewPane.mount(previewPaneEl as HTMLElement);

    this.searchInput.setCallbacks({
      onArrowDown: () => {
        this.resultsList.selectNext();
      },
      onArrowUp: () => {
        this.resultsList.selectPrevious();
      },
      onEnter: () => {
        this.resultsList.openSelected();
      },
      onPageUp: () => {
        this.resultsList.selectPageUp();
      },
      onPageDown: () => {
        this.resultsList.selectPageDown();
      },
      onHome: () => {
        this.resultsList.selectFirst();
      },
      onEnd: () => {
        this.resultsList.selectLast();
      },
      onCancel: () => {
        if (!this.isBusy) {
          return;
        }
        if (this.currentSearchId !== null) {
          this.setSearchCancelled(this.currentSearchId);
        }
        vscode.postMessage({ type: "cancelSearch" });
      },
    });

    document.addEventListener("keydown", (e) => {
      this.runGuarded("keydown", () => {
        if ((e.metaKey || e.ctrlKey) && e.key === "f") {
          if (!document.hasFocus()) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          this.searchInput.focus();
        }

        if (e.key === "Escape") {
          if (!this.isBusy) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (this.currentSearchId !== null) {
            this.setSearchCancelled(this.currentSearchId);
          }
          vscode.postMessage({ type: "cancelSearch" });
        }

        if ((e.metaKey || e.ctrlKey) && e.key === "m") {
          e.preventDefault();
          e.stopPropagation();
          this.toggleMode();
        }

        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "h") {
          e.preventDefault();
          e.stopPropagation();
          this.toggleReplace();
        }
      });
    });
  }

  private toggleMode(): void {
    if (!this.uiState) return;
    let newMode: "findFiles" | "findInFiles" | "findInOpenFiles";
    if (this.uiState.mode === "findInFiles") {
      newMode = "findInOpenFiles";
    } else if (this.uiState.mode === "findInOpenFiles") {
      newMode = "findFiles";
    } else {
      newMode = "findInFiles";
    }
    vscode.postMessage({ type: "modeChanged", mode: newMode });
  }

  private toggleReplace(): void {
    vscode.postMessage({ type: "toggleReplace" });
  }

  private handleReplaceOne(): void {
    if (!this.uiState || this.uiState.mode === "findFiles") return;

    const selected = this.resultsList.getSelectedResult();
    if (!selected) return;

    const replaceText = this.replaceInput.getValue();

    vscode.postMessage({
      type: "replaceOne",
      path: selected.path,
      line: selected.line,
      column: selected.column,
      matchLength: selected.matchText.length,
      replaceText,
    });
  }

  private handleReplaceAll(): void {
    if (!this.uiState || this.uiState.mode === "findFiles") return;

    const replaceText = this.replaceInput.getValue();

    vscode.postMessage({
      type: "replaceAll",
      replaceText,
    });
  }

  private runGuarded(context: string, action: () => void): void {
    try {
      action();
    } catch (error) {
      this.handleError(error, context);
    }
  }

  private async runGuardedAsync(
    context: string,
    action: () => Promise<void>,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.handleError(error, context);
    }
  }

  private handleError(error: unknown, context: string): void {
    this.errorCount += 1;
    console.error(`[Polaris Webview] App error in ${context}:`, error);

    if (!this.container) {
      return;
    }

    if (this.errorCount > 3) {
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected error";
    this.container.innerHTML = `
      <div class="polaris-search-app">
        <div class="results-placeholder">
          Something went wrong in the search UI. ${this.escapeHtml(message)}
        </div>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
