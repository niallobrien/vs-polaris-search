import {
  FileResultDTO,
  SearchResultDTO,
  PreviewDTO,
  UIStateDTO,
  ConfigDTO,
  SearchMode,
  ReplaceResult,
} from '../core/types';

export type ExtensionMessage =
  | { type: 'setBusy'; busy: boolean }
  | { type: 'setFileResults'; results: FileResultDTO[] }
  | { type: 'setSearchResults'; results: SearchResultDTO[]; totalCount: number }
  | { type: 'setPreview'; preview: PreviewDTO }
  | { type: 'setUIState'; state: UIStateDTO }
  | { type: 'setConfig'; config: ConfigDTO }
  | { type: 'focusSearchInput' }
  | { type: 'replaceComplete'; result: ReplaceResult };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'queryChanged'; query: string; includeGlobs?: string[]; excludeGlobs?: string[] }
  | { type: 'resultSelected'; path: string; line?: number }
  | { type: 'searchResultSelected'; path: string; line: number }
  | { type: 'openFile'; path: string; line?: number; mode?: 'current' | 'split' | 'tab' }
  | { type: 'modeChanged'; mode: SearchMode }
  | { type: 'toggleMatchCase' }
  | { type: 'toggleMatchWholeWord' }
  | { type: 'toggleUseRegex' }
  | { type: 'toggleLiveSearch' }
  | { type: 'toggleReplace' }
  | { type: 'replaceOne'; path: string; line: number; column: number; matchLength: number; replaceText: string }
  | { type: 'replaceAll'; replaceText: string };

export type MessageHandler = (message: WebviewMessage) => void;
