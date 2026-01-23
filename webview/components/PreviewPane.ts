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
    
    const lines = content.split('\n');
    const isLargeFile = lines.length > 1000;
    
    let contentToShow = content;
    let lineOffset = 0;
    let adjustedHighlightLine: number | undefined = highlightLine;
    
    if (isLargeFile && highlightLine !== undefined) {
      const contextLines = 200;
      const startLine = Math.max(0, highlightLine - contextLines);
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

    console.log('[PreviewPane] Highlight conditions:', {
      previewHighlightSearchTerm: this.config?.previewHighlightSearchTerm,
      searchTerm,
      highlightLine,
      adjustedHighlightLine,
      searchOptions
    });

    if (this.config?.previewHighlightSearchTerm && searchTerm && adjustedHighlightLine !== undefined) {
      console.log('[PreviewPane] Calling highlightSearchTerm');
      highlighted = this.highlightSearchTerm(highlighted, searchTerm, searchOptions, adjustedHighlightLine);
    } else {
      console.log('[PreviewPane] Skipping highlightSearchTerm');
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

    if (highlightLine !== undefined) {
      this.scrollToHighlightedLine();
    }
  }

  private scrollToHighlightedLine(): void {
    if (!this.container) {
      return;
    }

    setTimeout(() => {
      const previewContent = this.container?.querySelector('.preview-content') as HTMLElement;
      const highlightedLine = this.container?.querySelector('.highlighted-line') as HTMLElement;
      
      if (highlightedLine && previewContent) {
        const containerRect = previewContent.getBoundingClientRect();
        const lineRect = highlightedLine.getBoundingClientRect();
        const currentScrollTop = previewContent.scrollTop;
        
        const targetScrollTop = currentScrollTop + lineRect.top - containerRect.top - (containerRect.height / 2) + (lineRect.height / 2);
        
        previewContent.scrollTop = targetScrollTop;
      }
    }, 0);
  }

  private highlightSearchTerm(
    html: string,
    searchTerm: string,
    searchOptions: { matchCase: boolean; useRegex: boolean; matchWholeWord: boolean } | undefined,
    targetLineNumber: number
  ): string {
    if (!searchTerm.trim()) {
      return html;
    }

    try {
      const regex = this.buildSearchRegex(searchTerm, searchOptions);
      console.log('[PreviewPane] Finding closest match to line:', targetLineNumber);
      
      // Create a temporary container to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Find all matches with their line numbers
      const matches = this.findAllMatches(tempDiv, regex);
      console.log('[PreviewPane] Found matches:', matches.length);
      
      if (matches.length === 0) {
        return html;
      }
      
      // Find the match closest to the target line
      let closestMatch = matches[0];
      let minDistance = Math.abs(matches[0].lineNumber - targetLineNumber);
      
      for (const match of matches) {
        const distance = Math.abs(match.lineNumber - targetLineNumber);
        if (distance < minDistance) {
          minDistance = distance;
          closestMatch = match;
        }
      }
      
      console.log('[PreviewPane] Closest match at line:', closestMatch.lineNumber, 'distance:', minDistance);
      
      // Highlight only the closest match
      this.highlightSingleMatch(closestMatch);
      
      const result = tempDiv.innerHTML;
      console.log('[PreviewPane] Highlighted HTML contains mark tags?', result.includes('<mark'));
      return result;
    } catch (error) {
      console.error('Error highlighting search term:', error);
      return html;
    }
  }

  private findAllMatches(container: HTMLElement, regex: RegExp): Array<{node: Text, match: RegExpExecArray, lineNumber: number}> {
    const matches: Array<{node: Text, match: RegExpExecArray, lineNumber: number}> = [];
    
    const findInNode = (node: Node, currentLine: number): number => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            node: node as Text,
            match: match,
            lineNumber: currentLine
          });
        }
        return currentLine;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        
        // Count line breaks
        if (element.classList.contains('line')) {
          currentLine++;
        }
        
        // Skip already highlighted marks
        if (element.tagName.toLowerCase() === 'mark') {
          return currentLine;
        }
        
        for (const child of Array.from(node.childNodes)) {
          currentLine = findInNode(child, currentLine);
        }
      }
      return currentLine;
    };
    
    findInNode(container, 0);
    return matches;
  }

  private highlightSingleMatch(matchInfo: {node: Text, match: RegExpExecArray, lineNumber: number}): void {
    const {node, match} = matchInfo;
    const text = node.textContent || '';
    const fragment = document.createDocumentFragment();
    
    // Add text before match
    if (match.index > 0) {
      fragment.appendChild(document.createTextNode(text.substring(0, match.index)));
    }
    
    // Add highlighted match
    const mark = document.createElement('mark');
    mark.className = 'search-match';
    mark.textContent = match[0];
    fragment.appendChild(mark);
    
    // Add text after match
    const afterIndex = match.index + match[0].length;
    if (afterIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(afterIndex)));
    }
    
    node.parentNode?.replaceChild(fragment, node);
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
