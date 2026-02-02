# Polaris Search

Fast, beautiful search and replace for VS Code.

![Polaris Search Demo](polaris-search.gif)

## Features

✨ **Fuzzy File Finding** - Quickly locate files in your workspace with intelligent fuzzy matching

🔍 **Powerful Content Search** - Search inside files with blazing-fast ripgrep

🎨 **Beautiful Syntax Highlighting** - Preview results with stunning Shiki-powered syntax highlighting (15+ themes)

🔄 **Smart Replace** - Replace text across files with preserve-case logic

📂 **Find in Open Files** - Search only in currently open editor tabs

⚡ **Live Search** - See results as you type with configurable debouncing

💎 **Modern UI** - Clean, responsive interface with file icons and line numbers

🕒 **Search History** - Quickly recall your most recent searches (last 20)

📝 **Multi-line Search** - Search across multiple lines with full regex support

🌐 **Glob Pattern Filtering** - Include or exclude files using glob patterns

🔄 **Mode Cycling** - Quickly switch between search modes with `Cmd+M` / `Ctrl+M`

📏 **Large File Handling** - Smart 200-line context window for files over 1000 lines

🔄 **Stale File Detection** - Automatic refresh before replace operations

🛡️ **Error Boundaries** - Webview components fail gracefully without breaking the entire UI

🛠️ **Tool Detection Priority** - Automatically uses fd > ripgrep > VS Code API based on availability

⚙️ **Settings Sync** - Toggle preferences sync across workspaces

🌍 **30+ Language Support** - Comprehensive syntax highlighting for TypeScript, JavaScript, Python, Go, Rust, and more

🎨 **Theme Auto-detection** - Automatically matches VS Code's current theme

✨ **Dynamic Theme Updates** - Theme changes apply instantly without reload

✅ **Replace Confirmation** - Dialogs show occurrence count before confirming replacements

📑 **Multi-file Replace** - Replace text across multiple files in a single operation

💾 **Panel State Retention** - Preserves your search state and position when closing/reopening

## Search Modes

Polaris Search provides three powerful search modes:

| Mode                   | Description                                  | Tool             |
| ---------------------- | -------------------------------------------- | ---------------- |
| **Find in Files**      | Content search across all files in workspace | ripgrep          |
| **Find in Open Files** | Content search only in currently open tabs   | VS Code API      |
| **Find Files**         | Fuzzy file finding across workspace          | fd / VS Code API |

Cycle through modes using `Cmd+M` / `Ctrl+M`.

## Search Options

Toggle search behavior with these options:

| Option           | Mac     | Windows/Linux | Description                |
| ---------------- | ------- | ------------- | -------------------------- |
| Match Case       | `Alt+C` | `Alt+C`       | Match exact letter case    |
| Match Whole Word | `Alt+W` | `Alt+W`       | Match complete words only  |
| Use Regex        | `Alt+R` | `Alt+R`       | Enable regular expressions |
| Live Search      | `Alt+L` | `Alt+L`       | Show results as you type   |

## Keyboard Shortcuts

### Webview Navigation

| Key                            | Action                               |
| ------------------------------ | ------------------------------------ |
| `↑` / `↓`                      | Navigate through results             |
| `Page Up` / `Page Down`        | Navigate by pages                    |
| `Home` / `End`                 | Jump to top/bottom of results        |
| `Enter`                        | Open selected file at match location |
| `Shift+Enter`                  | Insert newline in search input       |
| `Cmd+M` / `Ctrl+M`             | Cycle through search modes           |
| `Cmd+Shift+H` / `Ctrl+Shift+H` | Toggle replace panel                 |
| `Cmd+F` / `Ctrl+F`             | Focus search input                   |
| `Cmd+Enter` / `Ctrl+Enter`     | Replace all occurrences              |
| `Alt+↑` / `Alt+↓`              | Cycle search history                 |

## Search History

Polaris Search keeps a rolling list of your most recent searches to help you reuse queries quickly.

- Stores up to 20 recent searches
- De-duplicates identical entries so your latest query stays at the top
- Cycle through history in the search box with `Alt+↑` / `Alt+↓`
- History is saved per-user using VS Code extension global state

### Commands

| Command              | Mac         | Windows/Linux             |
| -------------------- | ----------- | ------------------------- |
| Find in Files        | `Cmd+Alt+P` | `Ctrl+Alt+P`              |
| Find Files           | `Cmd+Alt+F` | `Ctrl+Alt+F`              |
| Find in Open Files   | `Cmd+Alt+O` | `Ctrl+Alt+O`              |
| Change Preview Theme | -           | Open from Command Palette |

Access all commands via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for "Polaris Search".

## Replace

Polaris Search provides powerful replace capabilities:

### Replace Operations

- **Replace One** - Press `Enter` on a result to replace that specific occurrence
- **Replace All** - Press `Cmd+Enter` / `Ctrl+Enter` to replace all matches across files
- **Toggle Replace Panel** - Show/hide replace input with `Cmd+Shift+H` / `Ctrl+Shift+H`

### Replace Features

- ✅ **Confirmation Dialogs** - Shows exact occurrence count before executing
- 🔄 **Stale File Detection** - Automatically detects and refreshes modified files before replace
- 📑 **Multi-file Replacement** - Replace across multiple files in a single operation
- 📊 **Success/Failure Reporting** - Clear feedback on replacement results

## Configuration

Customize Polaris Search through VS Code settings:

### Theme Options

Choose from 15 syntax highlighting themes:

- Tokyo Night
- Tokyo Night Storm
- Dracula
- GitHub Dark
- GitHub Light
- Nord
- One Dark Pro
- Catppuccin Mocha
- Catppuccin Latte
- Catppuccin Frappé
- Catppuccin Macchiato
- Monokai
- Solarized Dark
- Solarized Light
- VS Code Dark+

### Search Settings

- **Theme**: Choose from 15+ syntax highlighting themes
- **Preview Lines**: Adjust context lines shown in preview (range: 3-50, default: 10)
- **Search Delay**: Configure debounce delay for live search (range: 100-2000ms, default: 300ms)
- **Highlight**: Toggle search term highlighting in preview
- **Line Numbers**: Show/hide line numbers in preview pane

### Settings Sync

Toggle preferences (Match Case, Match Whole Word, Use Regex, Live Search) automatically sync across workspaces, maintaining your preferred search behavior.

## Language Support

Polaris Search provides syntax highlighting for 30+ languages:

- TypeScript, TSX
- JavaScript, JSX
- JSON
- CSS, SCSS, SASS, Less
- HTML, XML
- Markdown, MDX, MDC
- YAML
- Python
- Ruby
- Go
- Rust
- Java
- C, C++, C#
- PHP
- Swift
- Kotlin
- Bash, Zsh, Fish, PowerShell
- SQL
- GraphQL
- Astro
- Vue
- Svelte

## Performance

Polaris Search is optimized for speed and efficiency:

- ⚡ **Debounced Search** - Configurable delay prevents excessive searches while typing
- 💾 **File List Caching** - Workspace file lists cached per workspace for faster file finding
- 🛠️ **Tool Detection Caching** - Detected tools (fd, ripgrep) cached for the session
- 📊 **Result Limiting** - Maximum 100 file results to maintain performance

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=niallobrien.polaris-search) or search for "Polaris Search" in VS Code's Extensions view.

## Development

```bash
npm install
npm run watch
```

Press `F5` to launch the Extension Development Host.

## License

MIT
