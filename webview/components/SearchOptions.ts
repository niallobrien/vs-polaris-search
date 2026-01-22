import { vscode } from "../services/vscode";
import { SearchMode } from "../../src/core/types";

export interface SearchOptionsState {
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  liveSearch: boolean;
  mode: SearchMode;
  showReplace: boolean;
}

export class SearchOptions {
  private container: HTMLElement | null = null;
  private state: SearchOptionsState = {
    matchCase: false,
    matchWholeWord: true,
    useRegex: false,
    liveSearch: true,
    mode: "findInFiles",
    showReplace: false,
  };

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setState(state: Partial<SearchOptionsState>): void {
    this.state = { ...this.state, ...state };
    this.render();
  }

  private getTooltip(option: string): string {
    const mode = this.state.mode;

    const tooltips: Record<
      string,
      { findFiles: string; findInFiles: string; findInOpenFiles: string }
    > = {
      matchCase: {
        findFiles:
          "Match Case - Filter results where path matches exact case (Alt+C)",
        findInFiles: "Match Case (Alt+C)",
        findInOpenFiles: "Match Case (Alt+C)",
      },
      matchWholeWord: {
        findFiles:
          "Match Whole Word - Match complete path segments or words (Alt+W)",
        findInFiles: "Match Whole Word (Alt+W)",
        findInOpenFiles: "Match Whole Word (Alt+W)",
      },
      useRegex: {
        findFiles:
          "Use Regular Expression - Match paths using regex pattern (Alt+R)",
        findInFiles: "Use Regular Expression (Alt+R)",
        findInOpenFiles: "Use Regular Expression (Alt+R)",
      },
      liveSearch: {
        findFiles: "Live Search (Alt+L)",
        findInFiles: "Live Search (Alt+L)",
        findInOpenFiles: "Live Search (Alt+L)",
      },
      showReplace: {
        findFiles: "Toggle Replace (Cmd+Shift+H)",
        findInFiles: "Toggle Replace (Cmd+Shift+H)",
        findInOpenFiles: "Toggle Replace (Cmd+Shift+H)",
      },
    };

    return tooltips[option][mode];
  }

  private render(): void {
    if (!this.container) return;

    const showReplaceButton =
      this.state.mode !== "findFiles"
        ? `
      <button class="option-btn ${this.state.showReplace ? "active" : ""}" data-option="showReplace" title="${this.getTooltip("showReplace")}">
        <i class="codicon codicon-replace"></i>
      </button>
    `
        : "";

    this.container.innerHTML = `
      <div class="search-options">
        <button class="option-btn ${this.state.matchCase ? "active" : ""}" data-option="matchCase" title="${this.getTooltip("matchCase")}">Aa</button>
        <button class="option-btn ${this.state.matchWholeWord ? "active" : ""}" data-option="matchWholeWord" title="${this.getTooltip("matchWholeWord")}">Ab|</button>
        <button class="option-btn ${this.state.useRegex ? "active" : ""}" data-option="useRegex" title="${this.getTooltip("useRegex")}">.*</button>
        <button class="option-btn ${this.state.liveSearch ? "active" : ""}" data-option="liveSearch" title="${this.getTooltip("liveSearch")}">⚡</button>
        ${showReplaceButton}
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const buttons = this.container.querySelectorAll(".option-btn");
    buttons.forEach((button) => {
      // Prevent focus theft - keep focus on search input
      button.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });

      button.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const option = target.dataset.option;

        const messageMap: Record<string, string> = {
          matchCase: "toggleMatchCase",
          matchWholeWord: "toggleMatchWholeWord",
          useRegex: "toggleUseRegex",
          liveSearch: "toggleLiveSearch",
          showReplace: "toggleReplace",
        };

        if (option && messageMap[option]) {
          vscode.postMessage({ type: messageMap[option] });
        }
      });
    });
  }
}
