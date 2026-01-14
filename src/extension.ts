import * as vscode from 'vscode';
import { PolarisPanel } from './webview/PolarisPanel';

export function activate(context: vscode.ExtensionContext): void {
  const findFilesCommand = vscode.commands.registerCommand(
    'polaris.findFiles',
    () => {
      PolarisPanel.createOrShow(context.extensionUri, 'findFiles');
    }
  );

  const findInFilesCommand = vscode.commands.registerCommand(
    'polaris.findInFiles',
    () => {
      PolarisPanel.createOrShow(context.extensionUri, 'findInFiles');
    }
  );

  context.subscriptions.push(findFilesCommand, findInFilesCommand);
}

export function deactivate(): void {}
