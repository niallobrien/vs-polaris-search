import * as vscode from 'vscode';
import { ConfigDTO } from '../core/types';

function resolveSystemTheme(): string {
  const kind = vscode.window.activeColorTheme.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light:
    case vscode.ColorThemeKind.HighContrastLight:
      return 'light-plus';
    case vscode.ColorThemeKind.Dark:
    case vscode.ColorThemeKind.HighContrast:
    default:
      return 'dark-plus';
  }
}

export function getConfig(): ConfigDTO {
  const config = vscode.workspace.getConfiguration('polaris-search');
  const themeSetting = config.get<string>('theme', 'system');
  
  return {
    theme: themeSetting === 'system' ? resolveSystemTheme() : themeSetting,
    previewLines: config.get<number>('previewLines', 10),
    liveSearchDelay: config.get<number>('liveSearchDelay', 300),
    previewHighlightSearchTerm: config.get<boolean>('previewHighlightSearchTerm', true),
    previewShowLineNumbers: config.get<boolean>('previewShowLineNumbers', true),
  };
}

export function onConfigChange(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('polaris')) {
      callback();
    }
  });
}

export function onColorThemeChange(callback: () => void): vscode.Disposable {
  return vscode.window.onDidChangeActiveColorTheme(() => {
    const config = vscode.workspace.getConfiguration('polaris');
    if (config.get<string>('theme', 'system') === 'system') {
      callback();
    }
  });
}
