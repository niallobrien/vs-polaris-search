# Polaris VS Code Extension - Implementation Plan

## Phase 1: Foundation - Detailed Implementation Checklist

### 1.1 Project Initialization
- [ ] Create `package.json` with extension metadata, activation events, commands, keybindings, and configuration schema
- [ ] Create `tsconfig.json` for extension (Node.js/CommonJS target)
- [ ] Create `tsconfig.webview.json` for webview (ES modules, DOM lib)
- [ ] Create `esbuild.js` with dual build (extension bundle + webview bundle)
- [ ] Create `.gitignore` (node_modules, out, dist, .vscode-test)
- [ ] Create `.vscodeignore` for marketplace packaging
- [ ] Create `README.md` with basic description and feature list

**Acceptance Criteria:** `npm install && npm run build` succeeds, extension activates in Extension Development Host

---

### 1.2 Extension Entry Point
- [ ] Create `src/extension.ts` with `activate()` and `deactivate()`
- [ ] Register commands: `polaris.findFiles`, `polaris.findInFiles`
- [ ] Each command creates a new `PolarisPanel` instance

**Acceptance Criteria:** Commands appear in Command Palette, trigger without error

---

### 1.3 WebviewPanel Manager
- [ ] Create `src/webview/PolarisPanel.ts` class
- [ ] Implement panel creation with `vscode.window.createWebviewPanel()`
- [ ] Configure: `enableScripts: true`, `retainContextWhenHidden: true`, `localResourceRoots`
- [ ] Generate unique panel ID for multiple instances
- [ ] Set dynamic tab title: `🌟 Find Files` or `🌟 Find in Files`
- [ ] Handle panel disposal and cleanup
- [ ] Implement `postMessage()` wrapper for type-safe messaging

**Acceptance Criteria:** Panel opens in editor tab, multiple panels can coexist, proper cleanup on close

---

### 1.4 Message Protocol
- [ ] Create `src/core/types.ts` with shared type definitions
- [ ] Create `src/webview/messageProtocol.ts` with `ExtensionMessage` and `WebviewMessage` types
- [ ] Implement message handler registration in `PolarisPanel`
- [ ] Create `webview/services/vscode.ts` - wrapper for `acquireVsCodeApi()`

**Acceptance Criteria:** Messages flow bidirectionally, TypeScript catches protocol mismatches

---

### 1.5 Webview HTML Shell
- [ ] Create `webview/index.html` - minimal HTML structure with CSP
- [ ] Create `webview/styles/base.css` - CSS variables, reset, layout grid
- [ ] Create `webview/styles/components.css` - component-specific styles
- [ ] Create `webview/main.ts` - entry point, initializes app
- [ ] Create `webview/state.ts` - reactive state management (simple pub/sub)

**Acceptance Criteria:** Webview renders with proper layout, no CSP violations in console

---

### 1.6 Component Shell (UI Structure Only)
- [ ] Create `webview/components/App.ts` - root component, layout orchestration
- [ ] Create `webview/components/ModeTabs.ts` - Find Files / Find in Files tabs
- [ ] Create `webview/components/SearchInput.ts` - main search input field
- [ ] Create `webview/components/SearchOptions.ts` - toggle buttons (case, word, regex, live)
- [ ] Create `webview/components/ResultsList.ts` - scrollable results container (empty for now)
- [ ] Create `webview/components/PreviewPane.ts` - preview container (empty for now)
- [ ] Create `webview/components/StatusBar.ts` - bottom status bar

**Acceptance Criteria:** All UI sections render, layout matches design (two-pane: results left, preview right)

---

### 1.7 Shiki Integration
- [ ] Install `shiki` package
- [ ] Create `webview/services/highlighter.ts` - Shiki highlighter singleton
- [ ] Bundle OpenCode themes as JSON in `webview/themes/`
- [ ] Implement `highlight(code: string, lang: string, theme: string): string`
- [ ] Create theme selector dropdown in UI (or use VS Code setting initially)
- [ ] Apply theme CSS variables to webview

**Acceptance Criteria:** Sample code renders with syntax highlighting, theme switching works

---

### 1.8 Configuration
- [ ] Create `src/config/settings.ts` - read VS Code configuration
- [ ] Define settings: `polaris.theme`, `polaris.previewLines`, `polaris.liveSearchDelay`
- [ ] Pass initial config to webview on panel creation
- [ ] Listen for configuration changes, update webview

**Acceptance Criteria:** Settings appear in VS Code Settings UI, changes reflect in webview

---

### 1.9 Icon Asset
- [ ] Create `media/polaris-icon.svg` - simple star icon for extension

**Acceptance Criteria:** Icon displays in extension list and marketplace

---

## Phase 1 Deliverables Summary

| Component | Files |
|-----------|-------|
| Build Config | `package.json`, `tsconfig.json`, `tsconfig.webview.json`, `esbuild.js` |
| Extension | `src/extension.ts`, `src/webview/PolarisPanel.ts` |
| Protocol | `src/core/types.ts`, `src/webview/messageProtocol.ts` |
| Webview | `webview/index.html`, `webview/main.ts`, `webview/state.ts` |
| Components | 7 component files in `webview/components/` |
| Styles | `webview/styles/base.css`, `webview/styles/components.css` |
| Services | `webview/services/vscode.ts`, `webview/services/highlighter.ts` |
| Themes | Theme JSON files in `webview/themes/` |
| Config | `src/config/settings.ts` |
| Assets | `media/polaris-icon.svg` |

---

## Phase 2: Find Files (~2 days)
- [ ] Tool detection (ripgrep, fd)
- [ ] File finder implementation
- [ ] Fuzzy sorter (fuzzysort)
- [ ] File preview with syntax highlighting
- [ ] Open file actions

---

## Phase 3: Find in Files (~3 days)
- [ ] Content finder with ripgrep
- [ ] Search options (case, word, regex, live toggle)
- [ ] Include/exclude fields
- [ ] Flat list results with match highlighting
- [ ] Preview with context lines

---

## Phase 4: Replace (~2 days)
- [ ] Replace input UI
- [ ] Replace/Replace All actions
- [ ] Preserve case logic

---

## Phase 5: Polish (~2 days)
- [ ] Error handling
- [ ] Performance optimization
- [ ] README and marketplace listing

---

## Key Technical Specifications

### Message Protocol (Extension ↔ Webview)

```typescript
// Extension → Webview
type ExtensionMessage =
  | { type: 'setTheme'; theme: string }
  | { type: 'setBusy'; busy: boolean }
  | { type: 'setFileResults'; results: FileResultDTO[] }
  | { type: 'setSearchResults'; results: SearchResultDTO[]; totalCount: number }
  | { type: 'setPreview'; preview: PreviewDTO }
  | { type: 'setUIState'; state: UIStateDTO };

// Webview → Extension  
type WebviewMessage =
  | { type: 'queryChanged'; query: string }
  | { type: 'resultSelected'; index: number }
  | { type: 'openFile'; path: string; mode: 'current' | 'split' | 'tab' }
  | { type: 'toggleMatchCase' }
  | { type: 'toggleReplace' }
  | { type: 'replaceAll' }
  // ... etc
```

### Search Result Item Format (Flat List)

```
📄 logger.ts:14      const msg = [console.log](data);
📄 logger.ts:28      [console.log]('Starting server...');
```

- File icon from VS Code theme
- Filename:line number
- Truncated line content with match highlighted

---

## Keybindings

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Find Files | `Cmd+Shift+T` | `Ctrl+Shift+T` |
| Find in Files | `Cmd+Shift+G` | `Ctrl+Shift+G` |
| Toggle Match Case | `Alt+Cmd+C` | `Alt+Ctrl+C` |
| Toggle Whole Word | `Alt+Cmd+W` | `Alt+Ctrl+W` |
| Toggle Regex | `Alt+Cmd+R` | `Alt+Ctrl+R` |
| Toggle Live Search | `Alt+Cmd+L` | `Alt+Ctrl+L` |
| Toggle Search Details | `Alt+Cmd+D` | `Alt+Ctrl+D` |
| Toggle Replace | `Alt+Cmd+H` | `Alt+Ctrl+H` |
| Replace Selected | `Cmd+Shift+1` | `Ctrl+Shift+1` |
| Replace All | `Cmd+Shift+Enter` | `Ctrl+Shift+Enter` |

---

## Themes (from OpenCode)

```
system, tokyonight, everforest, ayu, catppuccin, catppuccin-macchiato, 
gruvbox, kanagawa, nord, matrix, one-dark, github-dark, github-light, 
dracula, solarized-dark, solarized-light
```

---

## Project Structure

```
polaris-search/
├── package.json
├── tsconfig.json
├── tsconfig.webview.json
├── esbuild.js
├── README.md
├── PLAN.md (this file)
│
├── media/
│   └── polaris-icon.svg
│
├── src/
│   ├── extension.ts
│   ├── core/
│   │   ├── types.ts
│   │   ├── preserveCase.ts
│   │   └── regexBuilder.ts
│   ├── finders/
│   │   ├── fileFinder.ts
│   │   └── contentFinder.ts
│   ├── adapters/
│   │   ├── tools/ (ripgrep.ts, fd.ts, toolDetector.ts)
│   │   ├── workspace/ (fileSystem.ts, workspaceSearch.ts)
│   │   └── icons.ts
│   ├── replace/
│   │   ├── replaceEngine.ts
│   │   └── preserveCase.ts
│   ├── webview/
│   │   ├── PolarisPanel.ts
│   │   ├── messageProtocol.ts
│   │   └── handlers/
│   └── config/
│       └── settings.ts
│
├── webview/
│   ├── index.html
│   ├── main.ts
│   ├── state.ts
│   ├── components/
│   │   ├── App.ts
│   │   ├── ModeTabs.ts
│   │   ├── SearchInput.ts
│   │   ├── ReplaceInput.ts
│   │   ├── SearchOptions.ts
│   │   ├── SearchDetails.ts
│   │   ├── ResultsList.ts
│   │   ├── FileResultItem.ts
│   │   ├── SearchResultItem.ts
│   │   ├── PreviewPane.ts
│   │   ├── PreviewHeader.ts
│   │   └── StatusBar.ts
│   ├── services/
│   │   ├── highlighter.ts (Shiki)
│   │   └── vscode.ts
│   ├── themes/*.json
│   └── styles/
│       ├── base.css
│       └── components.css
│
└── test/
```
