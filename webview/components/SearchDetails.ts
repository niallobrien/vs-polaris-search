export class SearchDetails {
  private container: HTMLElement | null = null;
  private visible: boolean = false;
  private includeInput: HTMLInputElement | null = null;
  private excludeInput: HTMLInputElement | null = null;
  private onChangeCallback: ((includeGlobs: string[], excludeGlobs: string[]) => void) | null = null;
  private onBlurCallback: (() => void) | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }

  setOnChange(callback: (includeGlobs: string[], excludeGlobs: string[]) => void): void {
    this.onChangeCallback = callback;
  }

  setOnBlur(callback: () => void): void {
    this.onBlurCallback = callback;
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="search-details" style="display: ${this.visible ? 'block' : 'none'};">
        <div class="search-details-row">
          <label for="include-globs">Include patterns:</label>
          <input
            type="text"
            id="include-globs"
            class="search-details-input"
            placeholder="e.g., *.ts, src/**/*.js"
          />
        </div>
        <div class="search-details-row">
          <label for="exclude-globs">Exclude patterns:</label>
          <input
            type="text"
            id="exclude-globs"
            class="search-details-input"
            placeholder="e.g., *.test.ts, **/*.spec.js"
          />
        </div>
      </div>
    `;

    this.includeInput = this.container.querySelector('#include-globs');
    this.excludeInput = this.container.querySelector('#exclude-globs');

    if (this.includeInput) {
      this.includeInput.addEventListener('input', () => this.handleChange());
      this.includeInput.addEventListener('blur', () => this.handleBlur());
    }

    if (this.excludeInput) {
      this.excludeInput.addEventListener('input', () => this.handleChange());
      this.excludeInput.addEventListener('blur', () => this.handleBlur());
    }
  }

  private handleBlur(): void {
    setTimeout(() => {
      if (this.onBlurCallback) {
        this.onBlurCallback();
      }
    }, 0);
  }

  private handleChange(): void {
    if (!this.onChangeCallback) return;

    const includeValue = this.includeInput?.value.trim() || '';
    const excludeValue = this.excludeInput?.value.trim() || '';

    const includeGlobs = includeValue
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0);

    const excludeGlobs = excludeValue
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0);

    this.onChangeCallback(includeGlobs, excludeGlobs);
  }
}
