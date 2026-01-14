import { vscode } from '../services/vscode';
import { SearchResultDTO } from '../../src/core/types';

export class SearchResultItem {
  private container: HTMLElement | null = null;
  private results: SearchResultDTO[] = [];
  private selectedIndex = -1;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setResults(results: SearchResultDTO[]): void {
    this.results = results;
    this.selectedIndex = results.length > 0 ? 0 : -1;
    this.render();

    if (this.selectedIndex >= 0) {
      vscode.postMessage({
        type: 'resultSelected',
        path: this.results[0].path,
        line: this.results[0].line
      });
    }
  }

  selectNext(): void {
    if (this.results.length === 0) return;
    
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
    this.render();
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectPrevious(): void {
    if (this.results.length === 0) return;
    
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.render();
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectFirst(): void {
    if (this.results.length === 0) return;
    this.selectedIndex = 0;
    this.render();
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectLast(): void {
    if (this.results.length === 0) return;
    this.selectedIndex = this.results.length - 1;
    this.render();
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectPageUp(): void {
    if (this.results.length === 0) return;
    
    const { container, items } = this.getListElements();
    if (!container || items.length === 0) return;
    
    const firstVisibleIndex = this.findFirstFullyVisibleIndex(container, items);
    const alreadyAtOrAboveFirstVisible = this.selectedIndex <= firstVisibleIndex;
    
    this.selectedIndex = alreadyAtOrAboveFirstVisible ? 0 : firstVisibleIndex;
    
    this.render();
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectPageDown(): void {
    if (this.results.length === 0) return;
    
    const { container, items } = this.getListElements();
    if (!container || items.length === 0) return;
    
    const lastVisibleIndex = this.findLastFullyVisibleIndex(container, items);
    const alreadyAtOrBelowLastVisible = this.selectedIndex >= lastVisibleIndex;
    
    this.selectedIndex = alreadyAtOrBelowLastVisible ? this.results.length - 1 : lastVisibleIndex;
    
    this.render();
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  openSelected(): void {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
      const result = this.results[this.selectedIndex];
      vscode.postMessage({
        type: 'openFile',
        path: result.path,
        line: result.line
      });
    }
  }

  private scrollSelectedIntoView(): void {
    if (!this.container) return;
    
    const selectedItem = this.container.querySelector('.search-result-item.selected');
    selectedItem?.scrollIntoView({ block: 'nearest' });
  }

  private notifySelection(): void {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
      const result = this.results[this.selectedIndex];
      vscode.postMessage({
        type: 'resultSelected',
        path: result.path,
        line: result.line
      });
    }
  }

  private render(): void {
    if (!this.container) return;

    if (this.results.length === 0) {
      this.container.innerHTML = `
        <div class="search-results-list">
          <div class="results-placeholder">No matches found. Try a different search.</div>
        </div>
      `;
      return;
    }

    const itemsHTML = this.results.map((result, index) => {
      const isSelected = index === this.selectedIndex;
      const fileName = result.path.split('/').pop() || result.path;
      
      const lineContent = this.highlightMatches(result);

      return `
        <div class="search-result-item ${isSelected ? 'selected' : ''}" data-index="${index}">
          <div class="search-result-details">
            <span class="search-result-location">${this.escapeHtml(fileName)}:${result.line}</span>
            <span class="search-result-content">${lineContent}</span>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="search-results-list">
        ${itemsHTML}
      </div>
    `;

    this.attachEventListeners();
  }

  private highlightMatches(result: SearchResultDTO): string {
    if (result.matches.length === 0) {
      return this.escapeHtml(result.lineText);
    }

    let html = '';
    let lastEnd = 0;

    const sortedMatches = [...result.matches].sort((a, b) => a.column - b.column);

    for (const match of sortedMatches) {
      const start = match.column;
      const end = start + match.matchText.length;

      html += this.escapeHtml(result.lineText.substring(lastEnd, start));
      html += `<mark class="search-match">${this.escapeHtml(match.matchText)}</mark>`;
      lastEnd = end;
    }

    html += this.escapeHtml(result.lineText.substring(lastEnd));

    return html;
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const items = this.container.querySelectorAll('.search-result-item');
    items.forEach((item) => {
      // Prevent focus theft - keep focus on search input
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      item.addEventListener('click', this.handleClick.bind(this));
      item.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    });
  }

  private handleClick(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const index = parseInt(target.dataset.index || '-1', 10);
    
    if (index >= 0 && index < this.results.length) {
      this.selectedIndex = index;
      this.render();
      
      const result = this.results[index];
      vscode.postMessage({
        type: 'resultSelected',
        path: result.path,
        line: result.line
      });
    }
  }

  private handleDoubleClick(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const index = parseInt(target.dataset.index || '-1', 10);
    
    if (index >= 0 && index < this.results.length) {
      const result = this.results[index];
      vscode.postMessage({
        type: 'openFile',
        path: result.path,
        line: result.line
      });
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getListElements(): { container: Element | null; items: NodeListOf<Element> } {
    const container = this.container?.querySelector('.search-results-list') ?? null;
    const items = container?.querySelectorAll('.search-result-item') ?? ([] as unknown as NodeListOf<Element>);
    return { container, items };
  }

  private findFirstFullyVisibleIndex(container: Element, items: NodeListOf<Element>): number {
    const containerRect = container.getBoundingClientRect();
    for (let i = 0; i < items.length; i++) {
      const itemRect = items[i].getBoundingClientRect();
      if (itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom) {
        return i;
      }
    }
    return 0;
  }

  private findLastFullyVisibleIndex(container: Element, items: NodeListOf<Element>): number {
    const containerRect = container.getBoundingClientRect();
    for (let i = items.length - 1; i >= 0; i--) {
      const itemRect = items[i].getBoundingClientRect();
      if (itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom) {
        return i;
      }
    }
    return this.results.length - 1;
  }
}
