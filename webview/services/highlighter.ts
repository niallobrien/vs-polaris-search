import {
  createHighlighter,
  Highlighter as ShikiHighlighter,
  BundledTheme,
} from "shiki";

const SUPPORTED_LANGS = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "json",
  "html",
  "css",
  "python",
  "java",
  "go",
  "rust",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "bash",
  "yaml",
  "markdown",
  "mdx",
  "mdc",
  "astro",
  "svelte",
  "vue",
];

class Highlighter {
  private shiki: ShikiHighlighter | null = null;
  private initPromise: Promise<void> | null = null;
  private currentTheme: BundledTheme | null = null;
  private loadedThemes: Set<string> = new Set();
  private themeBackgroundColors: Map<string, string> = new Map();

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.shiki = await createHighlighter({
        themes: ["dark-plus", "light-plus"],
        langs: SUPPORTED_LANGS,
      });
      this.loadedThemes.add("dark-plus");
      this.loadedThemes.add("light-plus");

      // Set default theme only if not already set via setTheme
      if (!this.currentTheme) {
        this.currentTheme = "dark-plus";
      }
    })();

    return this.initPromise;
  }

  async setTheme(theme: string): Promise<void> {
    console.log("[Polaris Highlighter] setTheme called with:", theme);
    const themeId = theme as BundledTheme;
    this.currentTheme = themeId;
    console.log(
      "[Polaris Highlighter] currentTheme set to:",
      this.currentTheme,
    );
    await this.initialize();

    if (!this.loadedThemes.has(theme) && this.shiki) {
      try {
        await this.shiki.loadTheme(themeId);
        this.loadedThemes.add(theme);
      } catch (error) {
        console.error(
          `Failed to load theme "${theme}", falling back to dark-plus:`,
          error,
        );
        this.currentTheme = "dark-plus";
        return;
      }
    }

    // Extract and store the background color from the theme
    if (this.shiki) {
      try {
        const shikiTheme = this.shiki.getTheme(themeId);
        const settingsBackground = shikiTheme.settings?.find(
          (setting) => setting.settings?.background,
        )?.settings?.background;
        const bgColor = shikiTheme.bg || settingsBackground;
        if (bgColor) {
          this.themeBackgroundColors.set(theme, bgColor);
          console.log(
            "[Polaris Highlighter] Background color for theme",
            theme,
            ":",
            bgColor,
          );
        }
      } catch (error) {
        console.error("Failed to extract background color from theme:", error);
      }
    }
  }

  getTheme(): string {
    return this.currentTheme || "dark-plus";
  }

  getThemeBackgroundColor(): string | undefined {
    if (this.currentTheme) {
      return this.themeBackgroundColors.get(this.currentTheme);
    }
    return undefined;
  }

  async highlight(
    code: string,
    language: string,
    highlightLine?: number,
  ): Promise<string> {
    await this.initialize();

    if (!this.shiki) {
      return this.escapeHtml(code);
    }

    try {
      const lines = code.split("\n");
      const maxLines = 10000;

      if (lines.length > maxLines) {
        return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
      }

      const html = this.shiki.codeToHtml(code, {
        lang: language,
        theme: this.currentTheme || "dark-plus",
      });

      if (highlightLine !== undefined) {
        return this.addLineHighlight(html, highlightLine);
      }

      return html;
    } catch (error) {
      console.error("Shiki highlighting failed:", error);
      return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
    }
  }

  private addLineHighlight(html: string, lineNumber: number): string {
    const lines = html.split("\n");
    if (lineNumber > 0 && lineNumber <= lines.length) {
      const lineIndex = lineNumber - 1;
      lines[lineIndex] = lines[lineIndex].replace(
        '<span class="line"',
        '<span class="line highlighted-line"',
      );
    }
    return lines.join("\n");
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

export const highlighter = new Highlighter();
