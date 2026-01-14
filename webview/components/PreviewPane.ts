import { PreviewDTO, ConfigDTO } from '../../src/core/types';
import { highlighter } from '../services/highlighter';

export class PreviewPane {
  private container: HTMLElement | null = null;
  private currentPreview: PreviewDTO | null = null;
  private config: ConfigDTO | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setConfig(config: ConfigDTO): void {
    this.config = config;
  }

  async setPreview(preview: PreviewDTO): Promise<void> {
    this.currentPreview = preview;
    await this.render();
  }

  clear(): void {
    this.currentPreview = null;
    this.render();
  }

  private async render(): Promise<void> {
    if (!this.container) {
      return;
    }

    if (!this.currentPreview) {
      this.container.innerHTML = `
        <div class="preview-pane">
          <div class="preview-placeholder">Select a result to preview</div>
        </div>
      `;
      return;
    }

    const { content, language, highlightLine, path, searchTerm, searchOptions } = this.currentPreview;
    let contentToShow = content;
    let lineOffset = 0;
    let adjustedHighlightLine: number | undefined = highlightLine;

    if (highlightLine !== undefined) {
      const lines = content.split('\n');
      const contextLines = 10;
      const startLine = Math.max(0, highlightLine - contextLines - 1);
      const endLine = Math.min(lines.length, highlightLine + contextLines);
      
      contentToShow = lines.slice(startLine, endLine).join('\n');
      lineOffset = startLine;
      adjustedHighlightLine = highlightLine - lineOffset;
    }

    let highlighted = await highlighter.highlight(
      contentToShow,
      language,
      adjustedHighlightLine
    );

    if (this.config?.previewHighlightSearchTerm && searchTerm && highlightLine !== undefined && adjustedHighlightLine !== undefined) {
      highlighted = this.highlightSearchTerm(highlighted, searchTerm, searchOptions, adjustedHighlightLine);
    }

    const fileName = path.split('/').pop() || path;
    const lineInfo = highlightLine !== undefined ? `:${highlightLine}` : '';
    
    const showLineNumbers = this.config?.previewShowLineNumbers ?? true;
    const lineNumberClass = showLineNumbers ? 'show-line-numbers' : '';
    const startingLineNumber = lineOffset + 1;
    const lineNumberStyle = showLineNumbers ? `style="--line-number-start: ${startingLineNumber};"` : '';

    this.container.innerHTML = `
      <div class="preview-pane">
        <div class="preview-header">
          <span class="preview-filename">${this.escapeHtml(fileName)}${lineInfo}</span>
          <span class="preview-path">${this.escapeHtml(path)}</span>
        </div>
        <div class="preview-content ${lineNumberClass}" ${lineNumberStyle}>
          ${highlighted}
        </div>
      </div>
    `;
  }

  private highlightSearchTerm(
    html: string,
    searchTerm: string,
    searchOptions: { matchCase: boolean; useRegex: boolean; matchWholeWord: boolean } | undefined,
    targetLineIndex: number
  ): string {
    if (!searchTerm.trim()) {
      return html;
    }

    const lines = html.split('\n');
    if (targetLineIndex < 0 || targetLineIndex >= lines.length) {
      return html;
    }

    try {
      const regex = this.buildSearchRegex(searchTerm, searchOptions);
      const targetLine = lines[targetLineIndex];
      const highlightedLine = this.highlightLineWithRegex(targetLine, regex);
      lines[targetLineIndex] = highlightedLine;
      return lines.join('\n');
    } catch (error) {
      console.error('Error highlighting search term:', error);
      return html;
    }
  }

  private buildSearchRegex(
    searchTerm: string,
    options: { matchCase: boolean; useRegex: boolean; matchWholeWord: boolean } | undefined
  ): RegExp {
    const matchCase = options?.matchCase ?? false;
    const useRegex = options?.useRegex ?? false;
    const matchWholeWord = options?.matchWholeWord ?? false;

    let pattern = searchTerm;
    
    if (!useRegex) {
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (matchWholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    const flags = matchCase ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  }

  private highlightLineWithRegex(lineHtml: string, regex: RegExp): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = lineHtml;

    this.highlightTextNodes(tempDiv, regex);

    return tempDiv.innerHTML;
  }

  private highlightTextNodes(node: Node, regex: RegExp): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      regex.lastIndex = 0;
      
      if (regex.test(text)) {
        regex.lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }

          const mark = document.createElement('mark');
          mark.className = 'search-match';
          mark.textContent = match[0];
          fragment.appendChild(mark);

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        node.parentNode?.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.tagName.toLowerCase() !== 'mark') {
        Array.from(node.childNodes).forEach(child => {
          this.highlightTextNodes(child, regex);
        });
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
