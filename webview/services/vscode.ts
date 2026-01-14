interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

class VSCodeBridge {
  private readonly api: VSCodeAPI;

  constructor() {
    this.api = acquireVsCodeApi();
  }

  postMessage(message: unknown): void {
    this.api.postMessage(message);
  }

  onMessage(handler: (message: unknown) => void): void {
    window.addEventListener('message', (event) => {
      handler(event.data);
    });
  }
}

export const vscode = new VSCodeBridge();
