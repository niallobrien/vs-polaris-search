import { getHighlighter, Highlighter as ShikiHighlighter } from 'shiki';

class Highlighter {
  private shiki: ShikiHighlighter | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.shiki = await getHighlighter({
        themes: ['dark-plus', 'light-plus'],
        langs: [
          'javascript',
          'typescript',
          'jsx',
          'tsx',
          'json',
          'html',
          'css',
          'python',
          'java',
          'go',
          'rust',
          'c',
          'cpp',
          'csharp',
          'php',
          'ruby',
          'bash',
          'yaml',
          'markdown',
        ],
      });
    })();

    return this.initPromise;
  }

  async highlight(code: string, language: string, highlightLine?: number): Promise<string> {
    await this.initialize();

    if (!this.shiki) {
      return this.escapeHtml(code);
    }

    try {
      const options: any = {
        lang: language,
        theme: 'dark-plus',
      };

      // Add line highlighting if specified
      if (highlightLine !== undefined) {
        options.lineOptions = [
          {
            line: highlightLine,
            classes: ['highlighted-line']
          }
        ];
      }

      return this.shiki.codeToHtml(code, options);
    } catch (error) {
      console.error('Shiki highlighting failed:', error);
      return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const highlighter = new Highlighter();

