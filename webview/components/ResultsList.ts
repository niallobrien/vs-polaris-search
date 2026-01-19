import { vscode } from '../services/vscode';
import { FileResultDTO, SearchResultDTO, SearchMode } from '../../src/core/types';

type ResultItem = FileResultDTO | SearchResultDTO;

export class ResultsList {
  private container: HTMLElement | null = null;
  private results: ResultItem[] = [];
  private selectedIndex = -1;
  private mode: 'files' | 'content' = 'files';
  private currentSearchMode: SearchMode = 'findInFiles';

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setSearchMode(searchMode: SearchMode): void {
    this.currentSearchMode = searchMode;
  }

  setResults(results: FileResultDTO[]): void {
    this.mode = 'files';
    this.results = results;
    this.selectedIndex = results.length > 0 ? 0 : -1;
    this.render();

    if (this.selectedIndex >= 0) {
      const result = this.results[0] as FileResultDTO;
      vscode.postMessage({
        type: 'resultSelected',
        path: result.path
      });
    }
  }

  setSearchResults(results: SearchResultDTO[]): void {
    this.mode = 'content';
    this.results = results;
    this.selectedIndex = results.length > 0 ? 0 : -1;
    this.render();

    if (this.selectedIndex >= 0) {
      const result = this.results[0] as SearchResultDTO;
      vscode.postMessage({
        type: 'resultSelected',
        path: result.path,
        line: result.line
      });
    }
  }

  selectNext(): void {
    if (this.results.length === 0) return;
    
    const newIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
    this.updateSelection(newIndex);
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectPrevious(): void {
    if (this.results.length === 0) return;
    
    const newIndex = Math.max(this.selectedIndex - 1, 0);
    this.updateSelection(newIndex);
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectFirst(): void {
    if (this.results.length === 0) return;
    this.updateSelection(0);
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectLast(): void {
    if (this.results.length === 0) return;
    this.updateSelection(this.results.length - 1);
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectPageUp(): void {
    if (this.results.length === 0) return;
    
    const { container, items } = this.getListElements();
    if (!container || items.length === 0) return;
    
    const firstVisibleIndex = this.findFirstFullyVisibleIndex(container, items);
    const alreadyAtOrAboveFirstVisible = this.selectedIndex <= firstVisibleIndex;
    
    const newIndex = alreadyAtOrAboveFirstVisible ? 0 : firstVisibleIndex;
    
    this.updateSelection(newIndex);
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  selectPageDown(): void {
    if (this.results.length === 0) return;
    
    const { container, items } = this.getListElements();
    if (!container || items.length === 0) return;
    
    const lastVisibleIndex = this.findLastFullyVisibleIndex(container, items);
    const alreadyAtOrBelowLastVisible = this.selectedIndex >= lastVisibleIndex;
    
    const newIndex = alreadyAtOrBelowLastVisible ? this.results.length - 1 : lastVisibleIndex;
    
    this.updateSelection(newIndex);
    this.scrollSelectedIntoView();
    this.notifySelection();
  }

  private updateSelection(newIndex: number): void {
    if (newIndex === this.selectedIndex) return;
    
    if (!this.container) {
      this.selectedIndex = newIndex;
      return;
    }
    
    const currentItem = this.container.querySelector(`.result-item[data-index="${this.selectedIndex}"]`);
    currentItem?.classList.remove('selected');
    
    const newItem = this.container.querySelector(`.result-item[data-index="${newIndex}"]`);
    newItem?.classList.add('selected');
    
    this.selectedIndex = newIndex;
  }

  openSelected(): void {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
      const result = this.results[this.selectedIndex];
      
      if (this.mode === 'files') {
        vscode.postMessage({
          type: 'openFile',
          path: (result as FileResultDTO).path
        });
      } else {
        const searchResult = result as SearchResultDTO;
        vscode.postMessage({
          type: 'openFile',
          path: searchResult.path,
          line: searchResult.line
        });
      }
    }
  }

  getSelectedResult(): { path: string; line: number; column: number; matchText: string } | null {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.results.length) {
      return null;
    }

    if (this.mode !== 'content') {
      return null;
    }

    const result = this.results[this.selectedIndex] as SearchResultDTO;
    if (!result.matches || result.matches.length === 0) {
      return null;
    }

    const firstMatch = result.matches[0];
    return {
      path: result.path,
      line: result.line,
      column: firstMatch.column,
      matchText: firstMatch.matchText
    };
  }

  private scrollSelectedIntoView(): void {
    if (!this.container) return;
    
    const selectedItem = this.container.querySelector('.result-item.selected');
    selectedItem?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  private notifySelection(): void {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
      const result = this.results[this.selectedIndex];
      
      if (this.mode === 'files') {
        vscode.postMessage({
          type: 'resultSelected',
          path: (result as FileResultDTO).path
        });
      } else {
        const searchResult = result as SearchResultDTO;
        vscode.postMessage({
          type: 'resultSelected',
          path: searchResult.path,
          line: searchResult.line
        });
      }
    }
  }

  private render(): void {
    if (!this.container) {
      return;
    }

    if (this.results.length === 0) {
      let placeholderText = 'No results yet. Start searching...';
      
      if (this.currentSearchMode === 'findInOpenFiles') {
        placeholderText = 'No files are currently open';
      }
      
      this.container.innerHTML = `
        <div class="results-list">
          <div class="results-placeholder">${placeholderText}</div>
        </div>
      `;
      return;
    }

    const itemsHTML = this.mode === 'files' 
      ? this.renderFileResults() 
      : this.renderSearchResults();

    this.container.innerHTML = `
      <div class="results-list">
        ${itemsHTML}
      </div>
    `;

    this.attachEventListeners();
  }

  private renderFileResults(): string {
    return (this.results as FileResultDTO[]).map((result, index) => {
      const isSelected = index === this.selectedIndex;
      const fileName = this.getFileName(result.path);
      const dirPath = this.getDirPath(result.path);
      const truncatedPath = this.truncatePathLeft(dirPath);
      
      let displayName: string;
      let displayPath: string;
      
      if (result.highlightedPath) {
        displayName = this.extractHighlightedFileName(result.highlightedPath, result.path);
        displayPath = this.extractHighlightedDirPath(result.highlightedPath, result.path, truncatedPath);
      } else {
        displayName = this.escapeHtml(fileName);
        displayPath = this.escapeHtml(truncatedPath);
      }

      return `
        <div class="result-item ${isSelected ? 'selected' : ''}" data-index="${index}">
          <div class="result-details">
            <div class="result-primary">${displayName}</div>
            <div class="result-secondary">${displayPath}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  private extractHighlightedFileName(highlightedHtml: string, originalPath: string): string {
    const fileName = this.getFileName(originalPath);
    const lastSlash = originalPath.lastIndexOf('/');
    
    if (lastSlash < 0) {
      return highlightedHtml;
    }
    
    return this.extractHighlightedSubstring(highlightedHtml, originalPath, lastSlash + 1, originalPath.length);
  }

  private extractHighlightedDirPath(highlightedHtml: string, originalPath: string, truncatedPath: string): string {
    const lastSlash = originalPath.lastIndexOf('/');
    
    if (lastSlash < 0) {
      return '';
    }
    
    const fullDirPath = originalPath.substring(0, lastSlash);
    
    if (fullDirPath.length <= 30) {
      return this.extractHighlightedSubstring(highlightedHtml, originalPath, 0, lastSlash);
    }
    
    return this.escapeHtml(truncatedPath);
  }

  private extractHighlightedSubstring(highlightedHtml: string, originalText: string, start: number, end: number): string {
    const substring = originalText.substring(start, end);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = highlightedHtml;
    const textContent = tempDiv.textContent || '';
    
    if (textContent !== originalText) {
      return this.escapeHtml(substring);
    }
    
    let htmlIndex = 0;
    let textIndex = 0;
    let result = '';
    let inTag = false;
    
    while (htmlIndex < highlightedHtml.length && textIndex <= end) {
      const char = highlightedHtml[htmlIndex];
      
      if (char === '<') {
        inTag = true;
        if (textIndex >= start && textIndex < end) {
          result += char;
        }
      } else if (char === '>') {
        inTag = false;
        if (textIndex >= start && textIndex < end) {
          result += char;
        }
      } else if (inTag) {
        if (textIndex >= start && textIndex < end) {
          result += char;
        }
      } else {
        if (textIndex >= start && textIndex < end) {
          result += char;
        }
        textIndex++;
      }
      
      htmlIndex++;
    }
    
    return result;
  }

  private renderSearchResults(): string {
    return (this.results as SearchResultDTO[]).map((result, index) => {
      const isSelected = index === this.selectedIndex;
      const fileName = this.getFileName(result.path);
      const lineTextWithHighlights = this.highlightMatches(result);

      return `
        <div class="result-item content-search ${isSelected ? 'selected' : ''}" data-index="${index}">
          <div class="result-details">
            <div class="result-primary">${lineTextWithHighlights}</div>
            <div class="result-secondary">${this.escapeHtml(fileName)}:<span class="line-number">${result.line}</span></div>
          </div>
        </div>
      `;
    }).join('');
  }

  private highlightMatches(result: SearchResultDTO): string {
    if (result.matches.length === 0) {
      return this.escapeHtml(result.lineText);
    }

    let html = '';
    let lastIndex = 0;

    for (const match of result.matches) {
      html += this.escapeHtml(match.beforeMatch.substring(lastIndex));
      html += `<mark class="search-match">${this.escapeHtml(match.matchText)}</mark>`;
      lastIndex = match.beforeMatch.length + match.matchText.length;
    }

    const lastMatch = result.matches[result.matches.length - 1];
    html += this.escapeHtml(lastMatch.afterMatch);

    return html;
  }

  private attachEventListeners(): void {
    if (!this.container) {
      return;
    }

    const items = this.container.querySelectorAll('.result-item');
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
      this.updateSelection(index);
      
      const result = this.results[index];
      if (this.mode === 'files') {
        vscode.postMessage({
          type: 'resultSelected',
          path: (result as FileResultDTO).path
        });
      } else {
        const searchResult = result as SearchResultDTO;
        vscode.postMessage({
          type: 'resultSelected',
          path: searchResult.path,
          line: searchResult.line
        });
      }
    }
  }

  private handleDoubleClick(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const index = parseInt(target.dataset.index || '-1', 10);
    
    if (index >= 0 && index < this.results.length) {
      const result = this.results[index];
      
      if (this.mode === 'files') {
        vscode.postMessage({
          type: 'openFile',
          path: (result as FileResultDTO).path
        });
      } else {
        const searchResult = result as SearchResultDTO;
        vscode.postMessage({
          type: 'openFile',
          path: searchResult.path,
          line: searchResult.line
        });
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private truncatePathLeft(path: string, maxLength: number = 30): string {
    if (!path || path.length <= maxLength) {
      return path;
    }
    
    const truncated = path.slice(-(maxLength - 1));
    const separatorIndex = truncated.indexOf('/');
    
    if (separatorIndex > 0 && separatorIndex < truncated.length - 1) {
      return '…' + truncated.slice(separatorIndex);
    }
    
    return '…' + truncated;
  }

  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  private getDirPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(0, lastSlash) : '';
  }

  private getListElements(): { container: Element | null; items: NodeListOf<Element> } {
    const container = this.container?.querySelector('.results-list') ?? null;
    const items = container?.querySelectorAll('.result-item') ?? ([] as unknown as NodeListOf<Element>);
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
