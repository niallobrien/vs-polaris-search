import { vscode } from '../services/vscode';

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
  private inputElement: HTMLTextAreaElement | null = null;
  private debounceTimer: number | null = null;
  private debounceDelay = 300;
  private callbacks: SearchInputCallbacks | null = null;
  private getExtraParams: (() => { includeGlobs?: string[]; excludeGlobs?: string[] }) | null = null;
  private liveSearch = true;
  private readonly MAX_HEIGHT = 150;

  mount(container: HTMLElement): void {
    container.innerHTML = `
      <div class="search-input-wrapper">
        <textarea 
          class="search-input" 
          placeholder="Search..."
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
