# Polaris Search

Fast, beautiful search and replace for VS Code.

## Features

✨ **Fuzzy File Finding** - Quickly locate files in your workspace with intelligent fuzzy matching

🔍 **Powerful Content Search** - Search inside files with blazing-fast ripgrep

🎨 **Beautiful Syntax Highlighting** - Preview results with stunning Shiki-powered syntax highlighting (15+ themes)

🔄 **Smart Replace** - Replace text across files with preserve-case logic

📂 **Find in Open Files** - Search only in currently open editor tabs

⚡ **Live Search** - See results as you type with configurable debouncing

💎 **Modern UI** - Clean, responsive interface with file icons and line numbers

## Commands & Keybindings

| Command            | Mac         | Windows/Linux |
| ------------------ | ----------- | ------------- |
| Find in Files      | `Cmd+Alt+P` | `Ctrl+Alt+P`  |
| Find Files         | `Cmd+Alt+F` | `Ctrl+Alt+F`  |
| Find in Open Files | `Cmd+Alt+O` | `Ctrl+Alt+O`  |

Access all commands via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for "Polaris Search".

## Configuration

Customize Polaris Search through VS Code settings:

- **Theme**: Choose from 15+ syntax highlighting themes (Tokyo Night, Dracula, GitHub, Nord, One Dark Pro, Catppuccin, and more)
- **Preview Lines**: Adjust context lines shown in preview (3-50 lines)
- **Search Delay**: Configure debounce delay for live search (100-2000ms)
- **Highlight**: Toggle search term highlighting in preview
- **Line Numbers**: Show/hide line numbers in preview pane

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
