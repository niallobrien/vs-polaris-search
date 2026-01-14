import { PreviewDTO } from '../../src/core/types';
import { highlighter } from '../services/highlighter';

export class PreviewPane {
  private container: HTMLElement | null = null;
  private currentPreview: PreviewDTO | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
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

    const { content, language, highlightLine, path } = this.currentPreview;
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

    const highlighted = await highlighter.highlight(
      contentToShow,
      language,
      adjustedHighlightLine
    );

    const fileName = path.split('/').pop() || path;
    const lineInfo = highlightLine !== undefined ? `:${highlightLine}` : '';

    this.container.innerHTML = `
      <div class="preview-pane">
        <div class="preview-header">
          <span class="preview-filename">${this.escapeHtml(fileName)}${lineInfo}</span>
          <span class="preview-path">${this.escapeHtml(path)}</span>
        </div>
        <div class="preview-content">
          ${highlighted}
        </div>
      </div>
    `;

    if (highlightLine !== undefined) {
      setTimeout(() => {
        const highlightedElement = this.container?.querySelector('.highlighted-line');
        if (highlightedElement) {
          highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
