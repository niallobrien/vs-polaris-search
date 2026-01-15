import { SearchInput } from './SearchInput';
import { SearchOptions } from './SearchOptions';
import { ResultsList } from './ResultsList';
import { SearchDetails } from './SearchDetails';
import { PreviewPane } from './PreviewPane';
import { FileResultDTO, PreviewDTO, ConfigDTO, UIStateDTO, SearchResultDTO } from '../../src/core/types';
import { vscode } from '../services/vscode';
import { highlighter } from '../services/highlighter';

export class App {
  private container: HTMLElement | null = null;

  private searchInput: SearchInput;
  private searchOptions: SearchOptions;
  private searchDetails: SearchDetails;
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
    this.searchDetails = new SearchDetails();
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
    const fileCount = new Set(results.map(r => r.path)).size;
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
      console.error('Failed to apply theme:', config.theme, error);
    }
  }

  setBusy(busy: boolean): void {
    if (busy) {
      this.hasSearched = true;
      this.updateResultSummary('Searching...');
    }
  }

  focusSearchInput(): void {
    this.searchInput.focus();
  }

  setUIState(state: UIStateDTO): void {
    this.uiState = state;
    
    this.searchInput.setMode(state.mode);
    this.searchOptions.setState({
      matchCase: state.matchCase,
      matchWholeWord: state.matchWholeWord,
      useRegex: state.useRegex,
      liveSearch: state.liveSearch,
      showSearchDetails: state.showSearchDetails,
      mode: state.mode,
    });
    
    this.searchInput.setLiveSearch(state.liveSearch);
    
    this.searchDetails.setVisible(state.showSearchDetails);
    this.updateResultsDisplay(state.mode);
    
    this.previewPane.clear();
    
    // Reset search state when mode changes
    this.hasSearched = false;
    this.updateResultSummary('');
  }

  private updateResultsDisplay(mode: 'findFiles' | 'findInFiles'): void {
    const resultsContainer = document.getElementById('results-list');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';
    this.resultsList.mount(resultsContainer);
  }

  private updateResultSummary(text: string): void {
    const summaryEl = document.getElementById('result-summary');
    if (summaryEl) {
      if (!this.hasSearched && text !== 'Searching...') {
        summaryEl.textContent = '';
      } else {
        summaryEl.textContent = text;
      }
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="polaris-app">
        <div class="polaris-header">
          <div class="search-row">
            <div id="search-input"></div>
            <div id="search-options"></div>
          </div>
          <div id="result-summary" class="result-summary"></div>
          <div id="search-details"></div>
        </div>
        <div class="polaris-content">
          <div class="polaris-results" id="results-list"></div>
          <div class="polaris-preview" id="preview-pane"></div>
        </div>
      </div>
    `;

    const searchInputEl = this.container.querySelector('#search-input');
    const searchOptionsEl = this.container.querySelector('#search-options');
    const searchDetailsEl = this.container.querySelector('#search-details');
    const resultsListEl = this.container.querySelector('#results-list');
    const previewPaneEl = this.container.querySelector('#preview-pane');

    if (searchInputEl) {
      this.searchInput.mount(searchInputEl as HTMLElement);
      this.searchInput.setExtraParamsProvider(() => ({
        includeGlobs: this.currentIncludeGlobs,
        excludeGlobs: this.currentExcludeGlobs
      }));
    }
    if (searchOptionsEl) this.searchOptions.mount(searchOptionsEl as HTMLElement);
    if (searchDetailsEl) {
      this.searchDetails.mount(searchDetailsEl as HTMLElement);
      this.searchDetails.setOnChange((includeGlobs, excludeGlobs) => {
        this.currentIncludeGlobs = includeGlobs;
        this.currentExcludeGlobs = excludeGlobs;
        
        const inputEl = document.querySelector('.search-input') as HTMLInputElement;
        if (inputEl && inputEl.value.trim()) {
          vscode.postMessage({
            type: 'queryChanged',
            query: inputEl.value,
            includeGlobs,
            excludeGlobs
          });
        }
      });
      this.searchDetails.setOnBlur(() => {
        this.searchInput.focus();
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

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        if (!document.hasFocus()) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.searchInput.focus();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMode();
      }
    });
  }

  private toggleMode(): void {
    if (!this.uiState) return;
    const newMode = this.uiState.mode === 'findInFiles' ? 'findFiles' : 'findInFiles';
    vscode.postMessage({ type: 'modeChanged', mode: newMode });
  }
}

