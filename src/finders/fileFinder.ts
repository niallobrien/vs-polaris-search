import fuzzysort from 'fuzzysort';
import { FileResultDTO } from '../core/types';
import { detectSearchTool } from '../adapters/tools/toolDetector';
import { findFilesWithFd } from '../adapters/tools/fd';
import { findFilesWithRipgrep } from '../adapters/tools/ripgrep';
import { findFilesWithVSCode } from '../adapters/tools/vscodeSearch';

let cachedFiles: string[] | null = null;
let cachedWorkspaceRoot: string | null = null;

export interface FileSearchOptions {
  matchCase?: boolean;
  matchWholeWord?: boolean;
  useRegex?: boolean;
}

export async function findFiles(
  query: string,
  workspaceRoot: string,
  options: FileSearchOptions = {}
): Promise<FileResultDTO[]> {
  const { matchCase = false, matchWholeWord = false, useRegex = false } = options;

  if (!query.trim()) {
    return [];
  }

  const allFiles = await getAllFiles(workspaceRoot);
  
  if (allFiles.length === 0) {
    return [];
  }

  if (useRegex) {
    return filterByRegex(allFiles, query, matchCase);
  }

  const results = fuzzysort.go(query, allFiles, {
    threshold: -10000,
    limit: 100,
  });

  let filtered = results.map(result => ({
    path: result.target,
    score: result.score,
    highlightedPath: highlightFuzzyResult(result)
  }));

  if (matchCase) {
    filtered = filtered.filter(r => r.path.includes(query));
  }

  if (matchWholeWord) {
    filtered = filtered.filter(r => matchesWholeWord(r.path, query, matchCase));
  }

  return filtered;
}

async function getAllFiles(workspaceRoot: string): Promise<string[]> {
  if (cachedFiles && cachedWorkspaceRoot === workspaceRoot) {
    return cachedFiles;
  }

  const tool = await detectSearchTool();

  let files: string[];
  switch (tool) {
    case 'fd':
      files = await findFilesWithFd(workspaceRoot);
      break;
    case 'rg':
      files = await findFilesWithRipgrep(workspaceRoot);
      break;
    case 'vscode':
      files = await findFilesWithVSCode(workspaceRoot);
      break;
  }

  cachedFiles = files;
  cachedWorkspaceRoot = workspaceRoot;
  
  return files;
}

function filterByRegex(files: string[], pattern: string, matchCase: boolean): FileResultDTO[] {
  try {
    const flags = matchCase ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    
    return files
      .filter(f => {
        regex.lastIndex = 0;
        return regex.test(f);
      })
      .slice(0, 100)
      .map((path, index) => ({
        path,
        score: -index,
        highlightedPath: highlightRegexMatches(path, pattern, matchCase)
      }));
  } catch {
    return [];
  }
}

function matchesWholeWord(filePath: string, query: string, matchCase: boolean): boolean {
  const segments = filePath.split(/[\/\\]/);
  const q = matchCase ? query : query.toLowerCase();
  
  return segments.some(segment => {
    const s = matchCase ? segment : segment.toLowerCase();
    const escapedQuery = escapeRegex(q);
    const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}\\b`, matchCase ? '' : 'i');
    return wordBoundaryRegex.test(segment);
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightFuzzyResult(result: any): string {
  const target = result.target;
  const indexes = result._indexes;
  const indexesLen = indexes.len || indexes.length;
  
  const indexSet = new Set<number>();
  for (let i = 0; i < indexesLen; i++) {
    indexSet.add(indexes[i]);
  }
  
  let html = '';
  let lastIndex = 0;
  let inMatch = false;
  
  for (let i = 0; i < target.length; i++) {
    const isMatch = indexSet.has(i);
    
    if (isMatch && !inMatch) {
      html += escapeHtml(target.substring(lastIndex, i));
      html += '<mark class="search-match">';
      inMatch = true;
      lastIndex = i;
    } else if (!isMatch && inMatch) {
      html += escapeHtml(target.substring(lastIndex, i));
      html += '</mark>';
      inMatch = false;
      lastIndex = i;
    }
  }
  
  if (inMatch) {
    html += escapeHtml(target.substring(lastIndex));
    html += '</mark>';
  } else {
    html += escapeHtml(target.substring(lastIndex));
  }
  
  return html;
}

function highlightRegexMatches(text: string, pattern: string, matchCase: boolean): string {
  try {
    const flags = matchCase ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    
    let html = '';
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      html += escapeHtml(text.substring(lastIndex, match.index));
      html += `<mark class="search-match">${escapeHtml(match[0])}</mark>`;
      lastIndex = match.index + match[0].length;
      
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
    
    html += escapeHtml(text.substring(lastIndex));
    
    return html;
  } catch {
    return escapeHtml(text);
  }
}

export function clearFileCache(): void {
  cachedFiles = null;
  cachedWorkspaceRoot = null;
}
