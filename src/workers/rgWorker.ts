import { spawn } from "child_process";
import * as readline from "readline";
import * as path from "path";
import { SearchResultDTO } from "../core/types";

type SearchMessage = {
  type: "search";
  options: {
    query: string;
    workspaceRoot: string;
    matchCase?: boolean;
    matchWholeWord?: boolean;
    useRegex?: boolean;
    includeGlobs?: string[];
    excludeGlobs?: string[];
    filePaths?: string[];
    maxResults?: number;
  };
};

type CancelMessage = { type: "cancel" };

let rgProcess: ReturnType<typeof spawn> | null = null;
let cancelled = false;

function sendMessage(message: unknown): void {
  if (process.send) {
    process.send(message);
  }
}

function buildArgs(options: SearchMessage["options"]): string[] {
  const {
    query,
    workspaceRoot,
    matchCase = false,
    matchWholeWord = false,
    useRegex = false,
    includeGlobs = [],
    excludeGlobs = [],
    filePaths = [],
    maxResults = 2000,
  } = options;

  const args = ["--json", "--line-number", "--column", "--no-heading", "--with-filename"];

  if (!matchCase) {
    args.push("--ignore-case");
  }

  if (matchWholeWord) {
    args.push("--word-regexp");
  }

  if (!useRegex) {
    args.push("--fixed-strings");
  }

  args.push("--max-count", String(maxResults));

  args.push("--hidden");
  args.push("--glob", "!.git/");
  args.push("--glob", "!node_modules/");
  args.push("--glob", "!dist/");
  args.push("--glob", "!out/");
  args.push("--glob", "!build/");

  if (query.includes("\n")) {
    args.push("--multiline");
    if (useRegex) {
      args.push("--multiline-dotall");
    }
  }

  if (filePaths.length > 0) {
    for (const glob of excludeGlobs) {
      if (glob.trim()) {
        args.push("--glob", `!${glob}`);
      }
    }

    args.push("--");
    args.push(query);

    for (const filePath of filePaths) {
      args.push(path.join(workspaceRoot, filePath));
    }
  } else {
    for (const glob of excludeGlobs) {
      if (glob.trim()) {
        args.push("--glob", `!${glob}`);
      }
    }

    for (const glob of includeGlobs) {
      if (glob.trim()) {
        args.push("--glob", glob);
      }
    }

    args.push("--");
    args.push(query);
    args.push(workspaceRoot);
  }

  return args;
}

async function runSearch(options: SearchMessage["options"]): Promise<void> {
  const { workspaceRoot, maxResults = 2000 } = options;
  const results: SearchResultDTO[] = [];
  const args = buildArgs(options);

  if (rgProcess) {
    try {
      rgProcess.kill();
    } catch {
      // Ignore kill errors when replacing a prior search.
    }
    rgProcess = null;
  }

  rgProcess = spawn("rg", args);

  const stdout = rgProcess.stdout;
  if (!stdout) {
    sendMessage({ type: "error", error: "rg stdout stream unavailable" });
    rgProcess = null;
    return;
  }

  const rl = readline.createInterface({
    input: stdout as NodeJS.ReadableStream,
  });
  let stderr = "";
  let settled = false;
  const lineBuffer: string[] = [];
  let processing = false;

  const finalize = (fn: () => void) => {
    if (settled) return;
    settled = true;
    rl.removeAllListeners();
    rl.close();
    rgProcess?.stdout?.removeAllListeners();
    rgProcess?.stderr?.removeAllListeners();
    rgProcess?.removeAllListeners();
    rgProcess = null;
    fn();
  };

  const processLines = async (): Promise<void> => {
    if (processing || settled) return;
    processing = true;

    let processed = 0;
    const batchSize = 200;

    while (lineBuffer.length > 0 && processed < batchSize) {
      if (cancelled) {
        finalize(() => sendMessage({ type: "cancelled" }));
        return;
      }

      const line = lineBuffer.shift();
      if (!line) {
        continue;
      }

      try {
        const result = JSON.parse(line);
        if (result.type === "match") {
          const relativePath = result.data.path.text
            .replace(workspaceRoot, "")
            .replace(/^\//, "");
          const lineNumber = result.data.line_number;
          const lineText = result.data.lines.text;

          const matches = result.data.submatches.map((submatch: any) => ({
            line: lineNumber,
            column: submatch.start,
            matchText: lineText.substring(submatch.start, submatch.end),
            beforeMatch: lineText.substring(0, submatch.start),
            afterMatch: lineText.substring(submatch.end),
          }));

          results.push({
            path: relativePath,
            line: lineNumber,
            column: result.data.submatches[0]?.start || 0,
            lineText: lineText.trimEnd(),
            matches,
            mtime: 0,
          });

          if (results.length >= maxResults) {
            try {
              rgProcess?.kill();
            } catch {
              // Ignore kill errors when stopping early.
            }
            finalize(() => sendMessage({ type: "results", results }));
            return;
          }
        }
      } catch {
        // Ignore malformed JSON.
      }

      processed += 1;
    }

    processing = false;

    if (lineBuffer.length > 0 && !settled) {
      setImmediate(() => {
        void processLines();
      });
    }
  };

  rl.on("line", (line) => {
    lineBuffer.push(line);
    void processLines();
  });

  rgProcess.stderr?.on("data", (data) => {
    stderr += data.toString();
  });

  rgProcess.on("close", async (code) => {
    if (!settled) {
      await processLines();
    }

    if (settled) {
      return;
    }

    if (cancelled) {
      finalize(() => sendMessage({ type: "cancelled" }));
      return;
    }

    if (code !== 0 && code !== 1) {
      finalize(() => sendMessage({ type: "error", error: `rg exited with code ${code}: ${stderr}` }));
      return;
    }

    finalize(() => sendMessage({ type: "results", results }));
  });

  rgProcess.on("error", (err) => {
    finalize(() => sendMessage({ type: "error", error: `Failed to spawn rg: ${err.message}` }));
  });
}

process.on("message", (message: SearchMessage | CancelMessage) => {
  if (message.type === "cancel") {
    cancelled = true;
    try {
      rgProcess?.kill();
    } catch {
      // Ignore kill errors.
    }
    return;
  }

  if (message.type === "search") {
    cancelled = false;
    void runSearch(message.options);
  }
});
