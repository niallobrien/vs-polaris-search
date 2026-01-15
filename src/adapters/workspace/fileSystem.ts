import * as vscode from 'vscode';
import * as path from 'path';
import type { PreviewDTO, SearchOptions } from '../../core/types';

export async function readFilePreview(
  workspaceRoot: string,
  relativePath: string,
  highlightLine?: number,
  searchTerm?: string,
  searchOptions?: SearchOptions
): Promise<PreviewDTO> {
  const absolutePath = path.join(workspaceRoot, relativePath);
  const uri = vscode.Uri.file(absolutePath);

  const fileContent = await vscode.workspace.fs.readFile(uri);
  const content = Buffer.from(fileContent).toString('utf-8');

  const language = detectLanguage(relativePath);

  return {
    path: relativePath,
    content,
    language,
    highlightLine,
    searchTerm,
    searchOptions
  };
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.json': 'json',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.html': 'html',
    '.xml': 'xml',
    '.md': 'markdown',
    '.mdx': 'mdx',
    '.mdc': 'mdc',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.py': 'python',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.fish': 'fish',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.astro': 'astro',
    '.vue': 'vue',
    '.svelte': 'svelte',
  };

  return languageMap[ext] || 'plaintext';
}
