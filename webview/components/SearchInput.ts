import { vscode } from '../services/vscode';
import { SearchMode } from '../../src/core/types';

export interface SearchInputCallbacks {
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnter: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
  onHome: () => void;
  onEnd: () => void;
}

export class SearchInput {
  private container: HTMLElement | null = null;
  private inputElement: HTMLTextAreaElement | null = null;
  private debounceTimer: number | null = null;
  private debounceDelay = 300;
  private callbacks: SearchInputCallbacks | null = null;
  private getExtraParams: (() => { includeGlobs?: string[]; excludeGlobs?: string[] }) | null = null;
  private liveSearch = true;
  private currentMode: SearchMode = 'findInFiles';
  private readonly MAX_HEIGHT = 150;

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = `
      <div class="search-input-wrapper">
        <button class="search-mode-prefix" title="Find in Files (⌘M to search files)">
          <i class="codicon codicon-search"></i>
        </button>
        <textarea 
          class="search-input" 
          placeholder="Search in files..."
          rows="1"
        ></textarea>
      </div>
    `;

    this.inputElement = container.querySelector('.search-input');
    
    if (this.inputElement) {
      this.inputElement.addEventListener('input', this.handleInput.bind(this));
      this.inputElement.addEventListener('keydown', this.handleKeyDown.bind(this));
      this.inputElement.addEventListener('paste', () => {
        setTimeout(() => this.autoResize(), 0);
      });
      this.inputElement.focus();
      this.autoResize();
    }

    const prefixBtn = container.querySelector('.search-mode-prefix');
    if (prefixBtn) {
      prefixBtn.addEventListener('mousedown', (e) => e.preventDefault());
      prefixBtn.addEventListener('click', () => {
        let newMode: SearchMode;
        if (this.currentMode === 'findInFiles') {
          newMode = 'findInOpenFiles';
        } else if (this.currentMode === 'findInOpenFiles') {
          newMode = 'findFiles';
        } else {
          newMode = 'findInFiles';
        }
        vscode.postMessage({ type: 'modeChanged', mode: newMode });
      });
    }
  }

  setCallbacks(callbacks: SearchInputCallbacks): void {
    this.callbacks = callbacks;
  }

  setDebounceDelay(delay: number): void {
    this.debounceDelay = delay;
  }

  setExtraParamsProvider(provider: () => { includeGlobs?: string[]; excludeGlobs?: string[] }): void {
    this.getExtraParams = provider;
  }

  setLiveSearch(enabled: boolean): void {
    this.liveSearch = enabled;
  }

  focus(): void {
    this.inputElement?.focus();
  }

  getInputElement(): HTMLTextAreaElement | null {
    return this.inputElement;
  }

  setMode(mode: SearchMode): void {
    this.currentMode = mode;
    this.updateModePrefix();
  }

  private updateModePrefix(): void {
    if (!this.container) return;
    
    const prefixBtn = this.container.querySelector('.search-mode-prefix');
    const icon = prefixBtn?.querySelector('.codicon');
    
    if (prefixBtn && icon) {
      let iconName: string;
      let tooltip: string;
      
      if (this.currentMode === 'findInFiles') {
        iconName = 'search';
        tooltip = 'Find in Files (⌘M to cycle modes)';
      } else if (this.currentMode === 'findInOpenFiles') {
        iconName = 'files';
        tooltip = 'Find in Open Files (⌘M to cycle modes)';
      } else {
        iconName = 'file';
        tooltip = 'Find Files (⌘M to cycle modes)';
      }
      
      icon.className = `codicon codicon-${iconName}`;
      prefixBtn.setAttribute('title', tooltip);
    }
    
    if (this.inputElement) {
      if (this.currentMode === 'findInFiles') {
        this.inputElement.placeholder = 'Search in files...';
      } else if (this.currentMode === 'findInOpenFiles') {
        this.inputElement.placeholder = 'Search in open files...';
      } else {
        this.inputElement.placeholder = 'Search files...';
      }
    }
  }

  private autoResize(): void {
    if (!this.inputElement) return;
    this.inputElement.style.height = 'auto';
    const newHeight = Math.min(this.inputElement.scrollHeight, this.MAX_HEIGHT);
    this.inputElement.style.height = `${newHeight}px`;
    this.inputElement.style.overflowY = 
      this.inputElement.scrollHeight > this.MAX_HEIGHT ? 'auto' : 'hidden';
  }

  private triggerSearch(): void {
    if (!this.inputElement) return;
    
    const query = this.inputElement.value;
    const extraParams = this.getExtraParams ? this.getExtraParams() : {};
    vscode.postMessage({
      type: 'queryChanged',
      query,
      ...extraParams
    });
  }

  private handleInput(event: Event): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.autoResize();

    if (!this.liveSearch) {
      return;
    }

    this.debounceTimer = window.setTimeout(() => {
      this.triggerSearch();
    }, this.debounceDelay);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.callbacks) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.callbacks.onArrowDown();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.callbacks.onArrowUp();
        break;
      case 'Enter':
        if (event.shiftKey) {
          // Allow newline insertion, then resize
          setTimeout(() => this.autoResize(), 0);
          return;
        }
        event.preventDefault();
        if (!this.liveSearch) {
          this.triggerSearch();
        } else if (this.callbacks) {
          this.callbacks.onEnter();
        }
        break;
      case 'PageUp':
        event.preventDefault();
        this.callbacks.onPageUp();
        break;
      case 'PageDown':
        event.preventDefault();
        this.callbacks.onPageDown();
        break;
      case 'Home':
        event.preventDefault();
        this.callbacks.onHome();
        break;
      case 'End':
        event.preventDefault();
        this.callbacks.onEnd();
        break;
    }
  }
}
