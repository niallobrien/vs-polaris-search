# PRD: Replace with Preview (Option B)

**Status:** Future Enhancement  
**Priority:** Medium  
**Depends On:** MVP Replace Feature  
**Estimated Effort:** 5-8 days

---

## Overview

Enhance the basic replace feature with preview capabilities and selective exclusion of results, matching VSCode's native search and replace UX. This provides users with confidence before making bulk replacements by showing before/after diffs and allowing granular control over which matches to replace.

---

## Goals

1. **Visual Preview**: Show before/after diff for selected match in preview pane
2. **Selective Exclusion**: Allow users to exclude individual results or entire files from replacement
3. **Safety**: Prevent accidental bulk replacements with clear visual feedback
4. **UX Consistency**: Match VSCode's native search/replace interaction patterns

---

## User Stories

### Story 1: Preview Before Replace
**As a** developer  
**I want to** see a diff preview of what will change when I replace  
**So that** I can verify the replacement is correct before applying it

**Acceptance Criteria:**
- When a search result is selected, preview pane shows the line with current match highlighted
- When replace input has text, preview pane shows both original and replacement side-by-side or inline
- Diff highlighting clearly shows what will be removed (red) and added (green)

### Story 2: Exclude Individual Results
**As a** developer  
**I want to** exclude specific matches from "Replace All"  
**So that** I can replace most occurrences but skip certain edge cases

**Acceptance Criteria:**
- Each search result has an exclude button (X icon or checkbox)
- Excluded results are visually marked (strikethrough, opacity, or checkmark state)
- "Replace All" only affects non-excluded results
- Status bar shows "X of Y results will be replaced" count

### Story 3: Exclude Entire Files
**As a** developer  
**I want to** exclude all matches in a specific file  
**So that** I don't have to individually exclude each match in files I want to skip

**Acceptance Criteria:**
- File-level exclude button/checkbox in results list
- Excluding a file excludes all matches within it
- Visual indicator shows file is excluded (grayed out, strikethrough)
- Can un-exclude files to include them again

---

## Functional Requirements

### 1. Preview Pane Enhancements

#### 1.1 Diff Display Modes

**Option A: Inline Diff** (Recommended)
```
12: const result = oldFunction(x)
    ────────────  ───────────
    const result = newFunction(x)
```

**Option B: Side-by-Side Diff**
```
┌─────────────────────┬─────────────────────┐
│ Before              │ After               │
├─────────────────────┼─────────────────────┤
│ oldFunction(x)      │ newFunction(x)      │
└─────────────────────┴─────────────────────┘
```

**Decision:** Start with **Inline Diff** (simpler, more compact).

#### 1.2 Diff Highlighting

- **Red background**: Text to be removed
- **Green background**: Text to be added
- Use VSCode theme colors:
  - `--vscode-diffEditor-removedTextBackground`
  - `--vscode-diffEditor-insertedTextBackground`

#### 1.3 Preview States

| State | Preview Display |
|-------|----------------|
| No replace text | Current behavior (show match highlighted) |
| Replace text entered | Show inline diff with before/after |
| Result excluded | Show "Excluded from replacement" message |

### 2. Result Exclusion System

#### 2.1 Data Structure

```typescript
interface ExclusionState {
  excludedResults: Set<string>;  // Set of result IDs: "path:line:column"
  excludedFiles: Set<string>;    // Set of file paths
}
```

#### 2.2 Result Item UI

Each result item in the list displays:
```
┌────────────────────────────────────────────────┐
│ [☐] 📄 src/utils.ts                      [✕]  │
│     12: const result = oldFunction(x)    [↻]  │
│     45: return oldFunction(data)         [↻]  │
└────────────────────────────────────────────────┘
```

**Icons:**
- `[☐]` / `[☑]` - File-level checkbox (exclude all matches in file)
- `[✕]` - File-level exclude button
- `[↻]` - Per-match replace button (replaces this one match only)

**Visual States:**
- **Normal**: Full opacity, default colors
- **Excluded**: 50% opacity, strikethrough text, gray color
- **Hover**: Highlight background, show exclude/include action

#### 2.3 Exclusion Actions

| Action | Behavior |
|--------|----------|
| Click file checkbox | Toggle all matches in file |
| Click match exclude button | Toggle single match exclusion |
| Click match replace button | Replace only this match (ignores exclusion) |
| "Replace All" button | Replace all non-excluded matches |

#### 2.4 Status Bar

Display replacement count in UI:
```
┌────────────────────────────────────────────────┐
│ 🔍 [oldFunction]  [Aa] [Ab|] [.*] [⚡] [↻]     │
│ ↳  [newFunction]  [Replace] [Replace All]     │
│                                                │
│ 42 of 58 results will be replaced             │
│ (16 excluded)                                  │
└────────────────────────────────────────────────┘
```

### 3. Replace All Workflow

#### 3.1 Confirmation Dialog

```
┌──────────────────────────────────────────┐
│  Replace in 42 matches across 8 files?   │
│                                          │
│  16 matches excluded                     │
│                                          │
│  Files to be modified:                   │
│  • src/utils.ts (12 matches)            │
│  • src/main.ts (8 matches)              │
│  • src/helpers.ts (5 matches)           │
│  ... and 5 more files                    │
│                                          │
│  [Cancel]              [Replace]         │
└──────────────────────────────────────────┘
```

#### 3.2 Post-Replace Actions

After successful replacement:
1. Show success notification: "Replaced 42 occurrences in 8 files"
2. Re-run search to refresh results
3. Clear exclusion state (fresh start for new search)
4. If 0 results after re-run, show "All matches replaced" message

### 4. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+L` / `Ctrl+Shift+L` | Select all non-excluded results |
| `Cmd+K` / `Ctrl+K` | Toggle exclusion of selected result |
| `Cmd+Shift+K` | Clear all exclusions |

---

## Technical Design

### 1. Component Changes

#### ResultsList.ts

```typescript
interface ResultsListState {
  excludedResults: Set<string>;
  excludedFiles: Set<string>;
}

class ResultsList {
  private exclusionState: ResultsListState;
  
  toggleResultExclusion(resultId: string): void {
    // Toggle individual result
  }
  
  toggleFileExclusion(filePath: string): void {
    // Toggle all results in file
  }
  
  getIncludedResults(): SearchResultDTO[] {
    // Filter out excluded results
  }
  
  getReplacementCount(): { total: number; included: number; excluded: number } {
    // Calculate counts for status display
  }
}
```

#### PreviewPane.ts

```typescript
interface PreviewOptions {
  showDiff: boolean;
  replaceText?: string;
  isExcluded: boolean;
}

class PreviewPane {
  async setPreviewWithDiff(
    preview: PreviewDTO, 
    replaceText: string,
    isExcluded: boolean
  ): Promise<void> {
    // Render inline diff
  }
  
  private renderInlineDiff(
    original: string, 
    replacement: string, 
    lineNumber: number
  ): string {
    // Generate diff HTML with proper highlighting
  }
}
```

### 2. Message Protocol Updates

```typescript
// New messages
export type WebviewMessage =
  | { type: 'toggleResultExclusion'; resultId: string }
  | { type: 'toggleFileExclusion'; filePath: string }
  | { type: 'clearExclusions' }
  | { type: 'replaceAll'; replaceText: string; excludedResults: string[]; excludedFiles: string[] }
  // ... existing messages
```

### 3. State Management

```typescript
// App.ts
class App {
  private exclusionState: ExclusionState = {
    excludedResults: new Set(),
    excludedFiles: new Set()
  };
  
  onSearchResultsChanged(): void {
    // Clear exclusions when new search is performed
    this.exclusionState = { excludedResults: new Set(), excludedFiles: new Set() };
  }
}
```

### 4. Replace All Logic Changes

```typescript
// PolarisPanel.ts
private async handleReplaceAll(
  replaceText: string,
  excludedResults: string[],
  excludedFiles: string[]
): Promise<void> {
  // Filter results
  const includedResults = this.lastSearchResults.filter(result => {
    const resultId = `${result.path}:${result.line}:${result.column}`;
    return !excludedResults.includes(resultId) && 
           !excludedFiles.includes(result.path);
  });
  
  // Build file summary for confirmation
  const fileGroups = this.groupResultsByFile(includedResults);
  const fileCount = fileGroups.size;
  const totalMatches = includedResults.length;
  
  // Show enhanced confirmation dialog
  const confirm = await this.showReplaceAllConfirmation(
    totalMatches,
    fileCount,
    fileGroups,
    excludedResults.length
  );
  
  if (!confirm) return;
  
  // Proceed with replacement (same as MVP)
  // ...
}
```

---

## UI/UX Specifications

### Visual Design

#### Result Item States

```css
/* Normal state */
.result-item {
  opacity: 1;
  cursor: pointer;
}

/* Excluded state */
.result-item.excluded {
  opacity: 0.5;
  text-decoration: line-through;
  color: var(--vscode-disabledForeground);
}

/* Hover state - show action buttons */
.result-item:hover .result-actions {
  display: flex;
}
```

#### Diff Preview Styling

```css
.preview-diff {
  font-family: var(--vscode-editor-font-family);
  line-height: 1.5;
}

.diff-removed {
  background: var(--vscode-diffEditor-removedTextBackground);
  color: var(--vscode-diffEditor-removedTextForeground, inherit);
  text-decoration: line-through;
}

.diff-added {
  background: var(--vscode-diffEditor-insertedTextBackground);
  color: var(--vscode-diffEditor-insertedTextForeground, inherit);
}
```

### Interaction Patterns

#### Exclusion Workflow

1. **Hover over result** → Exclude button appears
2. **Click exclude button** → Result becomes grayed/strikethrough
3. **Status bar updates** → "X of Y results will be replaced"
4. **Preview updates** → Shows "Excluded" message if selected
5. **Click exclude again** → Result is included again

#### Replace All Workflow

1. **Click "Replace All"** → Confirmation dialog appears
2. **Dialog shows summary** → Files, match counts, excluded count
3. **User clicks "Replace"** → WorkspaceEdit applied
4. **Success notification** → Shows replacement count
5. **Search re-runs** → Results refresh automatically
6. **Exclusions cleared** → Fresh state for next operation

---

## Implementation Phases

### Phase 1: Exclusion System (3 days)
- [ ] Add exclusion state management to App.ts and ResultsList.ts
- [ ] Add exclude buttons to result items
- [ ] Implement toggle exclusion logic
- [ ] Add status bar with replacement counts
- [ ] Update "Replace All" to respect exclusions

### Phase 2: Preview Diff (2 days)
- [ ] Implement inline diff rendering in PreviewPane.ts
- [ ] Add diff highlighting with VSCode theme colors
- [ ] Update preview to show diff when replace text is entered
- [ ] Handle excluded results in preview ("Excluded" message)

### Phase 3: Enhanced Confirmation (1 day)
- [ ] Build file summary for confirmation dialog
- [ ] Create enhanced confirmation dialog with file list
- [ ] Show excluded count in dialog

### Phase 4: Polish & Testing (2 days)
- [ ] Add keyboard shortcuts
- [ ] Improve visual feedback (animations, transitions)
- [ ] Test edge cases (large replacements, empty replace, file changes)
- [ ] User testing and refinements

---

## Success Metrics

| Metric | Target |
|--------|--------|
| User confidence in replacements | 95% positive feedback |
| Accidental bulk replacements | < 1% of Replace All operations |
| Preview load time | < 100ms for diff rendering |
| Exclusion interaction time | < 500ms per result toggle |

---

## Open Questions

1. **Should exclusions persist across search refinements?**  
   - If user changes search query, should exclusions be preserved?
   - Recommendation: Clear exclusions on new search (cleaner UX)

2. **Should we show a "Replace in Selection" option?**  
   - Allow replacing only within currently selected results?
   - Recommendation: Defer to later (adds complexity)

3. **Should we support regex capture groups in preview diff?**  
   - Example: Show `$1` substitution in preview
   - Recommendation: Yes, implement in Phase 2 (requires regex parsing)

4. **Maximum number of files to show in confirmation dialog?**  
   - Recommendation: Show top 10 files, then "... and X more"

5. **Should excluded state be saved to workspace storage?**  
   - Recommendation: No, exclusions are transient per-session

---

## Related Features

- **Option C: Replace with Preserve Case** - Case-aware replacements
- **Option D: Regex Capture Groups** - Advanced replacement patterns
- **Batch Operations** - Apply multiple find/replace operations at once
- **Replace in Selection** - Limit replacement scope to specific results

---

## References

- [VSCode Search and Replace UX](https://code.visualstudio.com/docs/editor/codebasics#_search-and-replace)
- [VSCode Diff Editor API](https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType)
- [VSCode WorkspaceEdit API](https://code.visualstudio.com/api/references/vscode-api#WorkspaceEdit)
- GitHub Issue: [Feature Request: Preserve Case - Find / Replace #9798](https://github.com/microsoft/vscode/issues/9798)

---

## Appendix: Wireframes

### Result List with Exclusion Controls

```
┌────────────────────────────────────────────────────────────┐
│ Search Results                            42 of 58 matches │
│                                           (16 excluded)     │
├────────────────────────────────────────────────────────────┤
│ [☑] 📄 src/utils.ts                                   [✕]  │
│     ├─ 12: const result = oldFunction(x)            [↻][✕]│
│     │      ─────────────  ──────────                      │
│     │      const result = newFunction(x)                  │
│     │                                                      │
│     ├─ 45: return oldFunction(data)                 [↻][✕]│
│     │      ──────────────────────                         │
│     │      return newFunction(data)                       │
│     │                                                      │
│     └─ 67: const x = oldFunction()     [EXCLUDED]         │
│           ─────────────────────────                       │
│           const x = newFunction()                         │
│                                                            │
│ [☐] 📄 src/main.ts                                    [✕]  │
│     ├─ 8: import { oldFunction }                    [↻][✕]│
│     │     ────────────────────                            │
│     │     import { newFunction }                          │
└────────────────────────────────────────────────────────────┘
```

### Confirmation Dialog

```
┌──────────────────────────────────────────────────────────┐
│  Replace in 42 matches across 8 files?                   │
│                                                          │
│  ⚠️  This action cannot be undone easily                 │
│                                                          │
│  Files to be modified:                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │ • src/utils.ts (12 matches)                       │ │
│  │ • src/main.ts (8 matches)                         │ │
│  │ • src/helpers.ts (5 matches)                      │ │
│  │ • src/components/App.ts (4 matches)               │ │
│  │ • src/services/api.ts (3 matches)                 │ │
│  │ ... and 3 more files                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  16 matches excluded from replacement                   │
│                                                          │
│  [Cancel]                              [Replace All]     │
└──────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Author:** Sisyphus (OpenCode AI)  
**Reviewers:** TBD
