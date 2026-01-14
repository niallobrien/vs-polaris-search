import * as vscode from 'vscode';
import { ConfigDTO } from '../core/types';

export function getConfig(): ConfigDTO {
  const config = vscode.workspace.getConfiguration('polaris');
  
  return {
    theme: config.get<string>('theme', 'system'),
    previewLines: config.get<number>('previewLines', 10),
    liveSearchDelay: config.get<number>('liveSearchDelay', 300),
  };
}

export function onConfigChange(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('polaris')) {
      callback();
    }
  });
}
