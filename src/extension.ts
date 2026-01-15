import * as vscode from 'vscode';
import { PolarisPanel } from './webview/PolarisPanel';

const TOGGLE_PREFS_KEY = 'polaris.togglePreferences';

export function activate(context: vscode.ExtensionContext): void {
  // Enable Settings Sync for toggle preferences
  context.globalState.setKeysForSync([TOGGLE_PREFS_KEY]);

  const findFilesCommand = vscode.commands.registerCommand(
    'polaris.findFiles',
    () => {
      PolarisPanel.createOrShow(context, 'findFiles');
    }
  );

  const findInFilesCommand = vscode.commands.registerCommand(
    'polaris.findInFiles',
    () => {
      PolarisPanel.createOrShow(context, 'findInFiles');
    }
  );

  context.subscriptions.push(findFilesCommand, findInFilesCommand);
}

export function deactivate(): void {}
