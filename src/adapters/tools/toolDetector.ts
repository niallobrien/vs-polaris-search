import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type SearchTool = 'fd' | 'rg' | 'vscode';

let cachedTool: SearchTool | null = null;

/**
 * Detects which file search tool is available on the system.
 * Priority: fd > ripgrep > VS Code API
 * Results are cached after first detection.
 */
export async function detectSearchTool(): Promise<SearchTool> {
  if (cachedTool) {
    return cachedTool;
  }

  if (await commandExists('fd')) {
    cachedTool = 'fd';
    return 'fd';
  }

  if (await commandExists('rg')) {
    cachedTool = 'rg';
    return 'rg';
  }

  cachedTool = 'vscode';
  return 'vscode';
}

async function commandExists(command: string): Promise<boolean> {
  const checkCommand = process.platform === 'win32' ? 'where' : 'which';
  
  try {
    await execAsync(`${checkCommand} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear cached tool (useful for testing)
 */
export function clearToolCache(): void {
  cachedTool = null;
}
