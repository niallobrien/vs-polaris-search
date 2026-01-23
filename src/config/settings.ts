import * as vscode from "vscode";
import { ConfigDTO } from "../core/types";

function resolveSystemTheme(): string {
  const activeTheme = vscode.window.activeColorTheme;
  const themeName =
    activeTheme.kind === vscode.ColorThemeKind.Light
      ? "light-plus"
      : "dark-plus";

  // Try to get workspace configuration to see the actual theme name
  const workbench = vscode.workspace.getConfiguration("workbench");
  const themeId = workbench.get<string>("colorTheme", "");

  console.log("[Polaris] Active theme ID:", themeId, "kind:", activeTheme.kind);

  // Map common VS Code themes to Shiki themes
  const themeNameLower = themeId.toLowerCase();

  if (themeNameLower.includes("tokyo night")) {
    return "tokyo-night";
  } else if (themeNameLower.includes("dracula")) {
    return "dracula";
  } else if (themeNameLower.includes("github dark")) {
    return "github-dark";
  } else if (themeNameLower.includes("github light")) {
    return "github-light";
  } else if (themeNameLower.includes("nord")) {
    return "nord";
  } else if (themeNameLower.includes("one dark")) {
    return "one-dark-pro";
  } else if (
    themeNameLower.includes("catppuccin") &&
    themeNameLower.includes("mocha")
  ) {
    return "catppuccin-mocha";
  } else if (
    themeNameLower.includes("catppuccin") &&
    themeNameLower.includes("latte")
  ) {
    return "catppuccin-latte";
  } else if (themeNameLower.includes("solarized dark")) {
    return "solarized-dark";
  } else if (themeNameLower.includes("solarized light")) {
    return "solarized-light";
  } else if (
    themeNameLower.includes("ros") &&
    themeNameLower.includes("pine")
  ) {
    return "rose-pine";
  } else if (themeNameLower.includes("monokai")) {
    return "monokai";
  } else if (
    themeNameLower.includes("dark+") ||
    themeNameLower.includes("dark plus")
  ) {
    return "dark-plus";
  } else if (
    themeNameLower.includes("light+") ||
    themeNameLower.includes("light plus")
  ) {
    return "light-plus";
  }

  // Fallback based on theme kind
  return themeName;
}

export function getConfig(): ConfigDTO {
  const config = vscode.workspace.getConfiguration("polaris-search");
  const themeSetting = config.get<string>("theme", "system");
  const resolvedTheme =
    themeSetting === "system" ? resolveSystemTheme() : themeSetting;

  // List of known light themes
  const LIGHT_THEMES = [
    "light-plus",
    "github-light",
    "catppuccin-latte",
    "solarized-light",
  ];

  // Determine if the theme is light or dark
  let themeKind: "light" | "dark" = "dark";
  const activeTheme = vscode.window.activeColorTheme.kind;

  if (themeSetting === "system") {
    themeKind = activeTheme === vscode.ColorThemeKind.Light ? "light" : "dark";
  } else {
    // Check if the resolved theme is in the list of known light themes
    themeKind = LIGHT_THEMES.includes(resolvedTheme) ? "light" : "dark";
  }

  console.log(
    "[Polaris] getConfig - themeSetting:",
    themeSetting,
    "resolvedTheme:",
    resolvedTheme,
    "themeKind:",
    themeKind,
    "VS Code theme kind:",
    vscode.window.activeColorTheme.kind,
  );

  return {
    theme: resolvedTheme,
    themeKind,
    previewLines: config.get<number>("previewLines", 10),
    liveSearchDelay: config.get<number>("liveSearchDelay", 300),
    previewHighlightSearchTerm: config.get<boolean>(
      "previewHighlightSearchTerm",
      true,
    ),
    previewShowLineNumbers: config.get<boolean>("previewShowLineNumbers", true),
  };
}

export function onConfigChange(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("polaris-search")) {
      callback();
    }
  });
}

export function onColorThemeChange(callback: () => void): vscode.Disposable {
  return vscode.window.onDidChangeActiveColorTheme(() => {
    const config = vscode.workspace.getConfiguration("polaris-search");
    if (config.get<string>("theme", "system") === "system") {
      callback();
    }
  });
}
