import { vscode } from './services/vscode';
import { App } from './components/App';
import { ExtensionMessage } from '../src/webview/messageProtocol';

const app = new App();

vscode.onMessage(async (message: unknown) => {
  const msg = message as ExtensionMessage;
  
  switch (msg.type) {
    case 'setFileResults':
      app.setFileResults(msg.results);
      break;
    case 'setSearchResults':
      app.setSearchResults(msg.results, msg.totalCount);
      break;
    case 'setPreview':
      await app.setPreview(msg.preview);
      break;
    case 'setBusy':
      app.setBusy(msg.busy);
      break;
    case 'setUIState':
      app.setUIState(msg.state);
      break;
    case 'setConfig':
      await app.setConfig(msg.config);
      break;
    case 'focusSearchInput':
      app.focusSearchInput();
      break;
  }
});

const appRoot = document.getElementById('app');
if (appRoot) {
  app.mount(appRoot);
}

vscode.postMessage({ type: 'ready' });

