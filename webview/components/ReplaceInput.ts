import { vscode } from '../services/vscode';

export interface ReplaceInputCallbacks {
  onReplace: () => void;
  onReplaceAll: () => void;
}

export class ReplaceInput {
  private container: HTMLElement | null = null;
  private inputElement: HTMLTextAreaElement | null = null;
  private visible: boolean = false;
  private callbacks: ReplaceInputCallbacks | null = null;
  private readonly MAX_HEIGHT = 150;

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = `
      <div class="replace-row ${this.visible ? 'visible' : ''}">
        <div class="replace-input-wrapper">
          <textarea 
            class="replace-input" 
            placeholder="Replace..."
            rows="1"
          ></textarea>
        </div>
        <div class="replace-buttons">
          <button class="replace-btn replace-one" title="Replace (Enter)">
            <i class="codicon codicon-replace"></i>
            Replace
          </button>
          <button class="replace-btn replace-all" title="Replace All (Cmd+Enter)">
            <i class="codicon codicon-replace-all"></i>
            All
          </button>
        </div>
      </div>
    `;

    this.inputElement = container.querySelector('.replace-input');
    
    if (this.inputElement) {
      this.inputElement.addEventListener('input', this.handleInput.bind(this));
      this.inputElement.addEventListener('keydown', this.handleKeyDown.bind(this));
      this.inputElement.addEventListener('paste', () => {
        setTimeout(() => this.autoResize(), 0);
      });
      this.autoResize();
    }

    const replaceOneBtn = container.querySelector('.replace-one');
    const replaceAllBtn = container.querySelector('.replace-all');

    if (replaceOneBtn) {
      replaceOneBtn.addEventListener('mousedown', (e) => e.preventDefault());
      replaceOneBtn.addEventListener('click', () => {
        if (this.callbacks) {
          this.callbacks.onReplace();
        }
      });
    }

    if (replaceAllBtn) {
      replaceAllBtn.addEventListener('mousedown', (e) => e.preventDefault());
      replaceAllBtn.addEventListener('click', () => {
        if (this.callbacks) {
          this.callbacks.onReplaceAll();
        }
      });
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.container) {
      const replaceRow = this.container.querySelector('.replace-row');
      if (replaceRow) {
        if (visible) {
          replaceRow.classList.add('visible');
        } else {
          replaceRow.classList.remove('visible');
        }
      }
    }
    
    if (visible && this.inputElement) {
      // Focus replace input when shown
      setTimeout(() => this.inputElement?.focus(), 0);
    }
  }

  getValue(): string {
    return this.inputElement?.value || '';
  }

  focus(): void {
    this.inputElement?.focus();
  }

  setCallbacks(callbacks: ReplaceInputCallbacks): void {
    this.callbacks = callbacks;
  }

  private autoResize(): void {
    if (!this.inputElement) return;
    this.inputElement.style.height = 'auto';
    const newHeight = Math.min(this.inputElement.scrollHeight, this.MAX_HEIGHT);
    this.inputElement.style.height = `${newHeight}px`;
    this.inputElement.style.overflowY = 
      this.inputElement.scrollHeight > this.MAX_HEIGHT ? 'auto' : 'hidden';
  }

  private handleInput(): void {
    this.autoResize();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (event.metaKey || event.ctrlKey) {
        // Cmd+Enter / Ctrl+Enter: Replace All
        event.preventDefault();
        if (this.callbacks) {
          this.callbacks.onReplaceAll();
        }
      } else if (!event.shiftKey) {
        // Enter (without shift): Replace One
        event.preventDefault();
        if (this.callbacks) {
          this.callbacks.onReplace();
        }
      } else {
        // Shift+Enter: Allow newline insertion
        setTimeout(() => this.autoResize(), 0);
      }
    }
  }
}
