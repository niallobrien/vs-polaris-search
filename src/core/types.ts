export type SearchMode = 'findFiles' | 'findInFiles';

export interface FileResultDTO {
  path: string;
  score: number;
  highlightedPath?: string;
}

export interface SearchMatch {
  line: number;
  column: number;
  matchText: string;
  beforeMatch: string;
  afterMatch: string;
}

export interface SearchResultDTO {
  path: string;
  line: number;
  column: number;
  lineText: string;
  matches: SearchMatch[];
  mtime: number; // File modification time in milliseconds since epoch
}

export interface SearchOptions {
  matchCase: boolean;
  useRegex: boolean;
  matchWholeWord: boolean;
}

export interface PreviewDTO {
  path: string;
  content: string;
  language: string;
  highlightLine?: number;
  searchTerm?: string;
  searchOptions?: SearchOptions;
}

export interface UIStateDTO {
  mode: SearchMode;
  busy: boolean;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  liveSearch: boolean;
  showReplace: boolean;
}

export interface ConfigDTO {
  theme: string;
  previewLines: number;
  liveSearchDelay: number;
  previewHighlightSearchTerm: boolean;
  previewShowLineNumbers: boolean;
}

export interface TogglePreferences {
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  liveSearch: boolean;
}

export interface ReplaceResult {
  success: boolean;
  replacedCount: number;
  failedFiles?: string[];
}
