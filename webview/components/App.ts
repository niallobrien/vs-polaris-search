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

  constructor() {
    this.searchInput = new SearchInput();
    this.searchOptions = new SearchOptions();
    this.replaceInput = new ReplaceInput();
    this.resultsList = new ResultsList();
    this.previewPane = new PreviewPane();
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setFileResults(results: FileResultDTO[]): void {
    this.hasSearched = true;
    this.resultsList.setResults(results);
    this.updateResultSummary(`${results.length} files`);

    if (results.length === 0) {
      this.previewPane.clear();
    }
  }

  setSearchResults(results: SearchResultDTO[], totalCount: number): void {
    this.hasSearched = true;
    this.resultsList.setSearchResults(results);
    const fileCount = new Set(results.map((r) => r.path)).size;
    this.updateResultSummary(`${totalCount} matches in ${fileCount}+ files`);

    if (results.length === 0) {
      this.previewPane.clear();
    }
  }

  async setPreview(preview: PreviewDTO): Promise<void> {
    this.currentPreviewData = preview;
    await this.previewPane.setPreview(preview);
  }

  async setConfig(config: ConfigDTO): Promise<void> {
    this.searchInput.setDebounceDelay(config.liveSearchDelay);

    this.previewPane.setConfig(config);

    const previousTheme = highlighter.getTheme();

    try {
      await highlighter.setTheme(config.theme);

      if (previousTheme !== config.theme && this.currentPreviewData) {
        await this.previewPane.setPreview(this.currentPreviewData);
      }
    } catch (error) {
      console.error("Failed to apply theme:", config.theme, error);
    }
  }

  setBusy(busy: boolean): void {
    if (busy) {
      this.hasSearched = true;
      this.updateResultSummary("Searching...");
    }
  }

  focusSearchInput(): void {
    this.searchInput.focus();
  }

  setUIState(state: UIStateDTO): void {
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
    });

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        if (!document.hasFocus()) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.searchInput.focus();
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
}
