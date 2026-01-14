import { vscode } from '../services/vscode';
import { SearchMode } from '../../src/core/types';

export class ModeTabs {
  private container: HTMLElement | null = null;
  private currentMode: SearchMode = 'findFiles';

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setMode(mode: SearchMode): void {
    this.currentMode = mode;
    this.render();
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mode-tabs">
        <button class="mode-tab ${this.currentMode === 'findFiles' ? 'active' : ''}" data-mode="findFiles">Find Files</button>
        <button class="mode-tab ${this.currentMode === 'findInFiles' ? 'active' : ''}" data-mode="findInFiles">Find in Files</button>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const buttons = this.container.querySelectorAll('.mode-tab');
    buttons.forEach((button) => {
      // Prevent focus theft - keep focus on search input
      button.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      
      button.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.dataset.mode as SearchMode;
        if (mode && mode !== this.currentMode) {
          vscode.postMessage({ type: 'modeChanged', mode });
        }
      });
    });
  }
}
