import { vscode } from '../services/vscode';
import { SearchMode } from '../../src/core/types';

export interface SearchOptionsState {
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  liveSearch: boolean;
  showSearchDetails: boolean;
  mode: SearchMode;
}

export class SearchOptions {
  private container: HTMLElement | null = null;
  private state: SearchOptionsState = {
    matchCase: false,
    matchWholeWord: false,
    useRegex: false,
    liveSearch: true,
    showSearchDetails: false,
    mode: 'findInFiles',
  };

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setState(state: Partial<SearchOptionsState>): void {
    this.state = { ...this.state, ...state };
    this.render();
  }

  private getTooltip(option: string): string {
    const isFindFiles = this.state.mode === 'findFiles';
    
    const tooltips: Record<string, { findFiles: string; findInFiles: string }> = {
      matchCase: {
        findFiles: 'Match Case - Filter results where path matches exact case (Alt+C)',
        findInFiles: 'Match Case (Alt+C)',
      },
      matchWholeWord: {
        findFiles: 'Match Whole Word - Match complete path segments or words (Alt+W)',
        findInFiles: 'Match Whole Word (Alt+W)',
      },
      useRegex: {
        findFiles: 'Use Regular Expression - Match paths using regex pattern (Alt+R)',
        findInFiles: 'Use Regular Expression (Alt+R)',
      },
      liveSearch: {
        findFiles: 'Live Search (Alt+L)',
        findInFiles: 'Live Search (Alt+L)',
      },
      showSearchDetails: {
        findFiles: 'Search Details (Alt+D)',
        findInFiles: 'Search Details (Alt+D)',
      },
    };
    
    return isFindFiles ? tooltips[option].findFiles : tooltips[option].findInFiles;
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="search-options">
        <button class="option-btn ${this.state.matchCase ? 'active' : ''}" data-option="matchCase" title="${this.getTooltip('matchCase')}">Aa</button>
        <button class="option-btn ${this.state.matchWholeWord ? 'active' : ''}" data-option="matchWholeWord" title="${this.getTooltip('matchWholeWord')}">Ab|</button>
        <button class="option-btn ${this.state.useRegex ? 'active' : ''}" data-option="useRegex" title="${this.getTooltip('useRegex')}">.*</button>
        <button class="option-btn ${this.state.liveSearch ? 'active' : ''}" data-option="liveSearch" title="${this.getTooltip('liveSearch')}">⚡</button>
        <button class="option-btn ${this.state.showSearchDetails ? 'active' : ''}" data-option="showSearchDetails" title="${this.getTooltip('showSearchDetails')}">⋮</button>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const buttons = this.container.querySelectorAll('.option-btn');
    buttons.forEach((button) => {
      // Prevent focus theft - keep focus on search input
      button.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      
      button.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const option = target.dataset.option;
        
        const messageMap: Record<string, string> = {
          matchCase: 'toggleMatchCase',
          matchWholeWord: 'toggleMatchWholeWord',
          useRegex: 'toggleUseRegex',
          liveSearch: 'toggleLiveSearch',
          showSearchDetails: 'toggleSearchDetails',
        };

        if (option && messageMap[option]) {
          vscode.postMessage({ type: messageMap[option] });
        }
      });
    });
  }
}
