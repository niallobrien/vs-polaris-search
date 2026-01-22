import * as vscode from "vscode";
import { PolarisPanel } from "./webview/PolarisPanel";

const TOGGLE_PREFS_KEY = "polaris-search.togglePreferences";

export function activate(context: vscode.ExtensionContext): void {
  // Enable Settings Sync for toggle preferences
  context.globalState.setKeysForSync([TOGGLE_PREFS_KEY]);

  const findFilesCommand = vscode.commands.registerCommand(
    "polaris-search.findFiles",
    () => {
      PolarisPanel.createOrShow(context, "findFiles");
    },
  );

  const findInFilesCommand = vscode.commands.registerCommand(
    "polaris-search.findInFiles",
    () => {
      PolarisPanel.createOrShow(context, "findInFiles");
    },
  );

  const findInOpenFilesCommand = vscode.commands.registerCommand(
    "polaris-search.findInOpenFiles",
    () => {
      PolarisPanel.createOrShow(context, "findInOpenFiles");
    },
  );

  const changePreviewThemeCommand = vscode.commands.registerCommand(
    "polaris-search.changePreviewTheme",
    () => {
      PolarisPanel.showThemePicker();
    },
  );

  context.subscriptions.push(
    findFilesCommand,
    findInFilesCommand,
    findInOpenFilesCommand,
    changePreviewThemeCommand,
  );
}

export function deactivate(): void {}
