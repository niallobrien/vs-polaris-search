import { spawn } from 'child_process';
import { promises as fs } from 'fs';
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
  } = options;

  if (!query.trim()) {
    return [];
  }

  const args = [
    '--json',
    '--line-number',
    '--column',
    '--no-heading',
    '--with-filename',
  ];

  if (!matchCase) {
    args.push('--ignore-case');
  }

  if (matchWholeWord) {
    args.push('--word-regexp');
  }

  if (!useRegex) {
    args.push('--fixed-strings');
  }

  args.push('--hidden');
  args.push('--glob', '!.git/');
  args.push('--glob', '!node_modules/');
  args.push('--glob', '!dist/');
  args.push('--glob', '!out/');
  args.push('--glob', '!build/');

  // Enable multi-line matching if query contains newlines
  if (query.includes('\n')) {
    args.push('--multiline');
    if (useRegex) {
      args.push('--multiline-dotall');
    }
  }

  for (const glob of excludeGlobs) {
    if (glob.trim()) {
      args.push('--glob', `!${glob}`);
    }
  }

  for (const glob of includeGlobs) {
    if (glob.trim()) {
      args.push('--glob', glob);
    }
  }

  args.push('--');
  args.push(query);
  args.push(workspaceRoot);

  return new Promise((resolve, reject) => {
    const results: SearchResultDTO[] = [];
    const rgProcess = spawn('rg', args);

    let stdout = '';
    let stderr = '';

    rgProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    rgProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    rgProcess.on('close', async (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`rg exited with code ${code}: ${stderr}`));
        return;
      }

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      
      for (const line of lines) {
        try {
          const result = JSON.parse(line);
          
          if (result.type === 'match') {
            const relativePath = result.data.path.text.replace(workspaceRoot, '').replace(/^\//, '');
            const absolutePath = path.join(workspaceRoot, relativePath);
            const lineNumber = result.data.line_number;
            const lineText = result.data.lines.text;

            const matches = result.data.submatches.map((submatch: any) => ({
              line: lineNumber,
              column: submatch.start,
              matchText: lineText.substring(submatch.start, submatch.end),
              beforeMatch: lineText.substring(0, submatch.start),
              afterMatch: lineText.substring(submatch.end),
            }));

            let mtime = Date.now();
            try {
              const stats = await fs.stat(absolutePath);
              mtime = stats.mtimeMs;
            } catch (e) {
            }

            results.push({
              path: relativePath,
              line: lineNumber,
              column: result.data.submatches[0]?.start || 0,
              lineText: lineText.trimEnd(),
              matches,
              mtime,
            });
          }
        } catch (e) {
          continue;
        }
      }

      resolve(results);
    });

    rgProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn rg: ${err.message}`));
    });
  });
}
