import { fork } from 'child_process';
import * as path from 'path';
import { SearchResultDTO } from '../core/types';

export interface ContentSearchOptions {
  query: string;
  workspaceRoot: string;
  matchCase?: boolean;
  matchWholeWord?: boolean;
  useRegex?: boolean;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  filePaths?: string[];
  signal?: AbortSignal;
  maxResults?: number;
}

export async function findInFiles(options: ContentSearchOptions): Promise<SearchResultDTO[]> {
  const {
    query,
    workspaceRoot,
    matchCase = false,
    matchWholeWord = false,
    useRegex = false,
    includeGlobs = [],
    excludeGlobs = [],
    filePaths = [],
    signal,
    maxResults = 2000,
  } = options;

  if (!query.trim()) {
    return [];
  }

  if (signal?.aborted) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'rgWorker.js');
    const worker = fork(workerPath, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    let settled = false;

    const finalize = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      worker.removeAllListeners();
      fn();
    };

    const onAbort = () => {
      worker.send({ type: 'cancel' });
      setTimeout(() => {
        try {
          worker.kill();
        } catch {
          // Ignore kill errors during abort.
        }
      }, 2000);
      finalize(() => resolve([]));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    worker.on('message', (message: any) => {
      if (message?.type === 'results') {
        finalize(() => resolve(message.results as SearchResultDTO[]));
      } else if (message?.type === 'cancelled') {
        finalize(() => resolve([]));
      } else if (message?.type === 'error') {
        finalize(() => reject(new Error(message.error)));
      }
    });

    worker.on('error', (err) => {
      finalize(() => reject(new Error(`Worker error: ${err.message}`)));
    });

    worker.on('exit', (code) => {
      if (!settled) {
        if (code && code !== 0) {
          finalize(() => reject(new Error(`Worker exited with code ${code}`)));
        } else {
          finalize(() => resolve([]));
        }
      }
    });

    worker.send({
      type: 'search',
      options: {
        query,
        workspaceRoot,
        matchCase,
        matchWholeWord,
        useRegex,
        includeGlobs,
        excludeGlobs,
        filePaths,
        maxResults,
      },
    });
  });
}
