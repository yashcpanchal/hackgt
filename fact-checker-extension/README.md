# Notion Highlighter Extension

Advanced text highlighting extension for Notion with persistent overlay system, now built with TypeScript for better code quality and maintainability.

## ✨ Features

- **Persistent Highlighting**: Highlights stay visible regardless of focus states or interactions
- **Smooth Scrolling**: Highlights follow scroll and resize events smoothly using `requestAnimationFrame`
- **Cross-Styled Text Search**: Find and highlight text that spans bold/italic formatting
- **Floating Overlay System**: Non-intrusive highlighting that doesn't modify Notion's DOM
- **Keyboard Shortcuts**:
  - `Alt+H`: Highlight selected text
  - `Alt+Shift+C`: Clear all highlights
- **Double-Click Highlighting**: Quick highlighting with double-click
- **Search and Highlight**: Find and highlight all instances of text
- **Auto-Recovery**: Automatically restores highlights if they disappear

## 🛠️ Development Setup

### Prerequisites

- Node.js (v16 or higher)
- TypeScript
- Chrome browser

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd docs-highlighter-extension
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```

3. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

### Development Workflow

- **Build once:** `npm run build`
- **Watch mode:** `npm run watch` or `npm run dev`
- **Clean build:** `npm run clean && npm run build`

### TypeScript Structure

```
src/
├── types.ts          # Type definitions and interfaces
├── content.ts        # Main content script (converted from content.js)
├── popup.ts          # Popup UI controller (converted from popup.js)
└── background.ts     # Background service worker

dist/                 # Compiled JavaScript files
├── content.js
├── popup.js
└── background.js
```

## 🏗️ Architecture

### Core Components

1. **NotionHighlighter Class** (`content.ts`):
   - Manages highlight state and overlay system
   - Handles scroll/mouse event coordination
   - Provides persistent storage integration

2. **PopupController Class** (`popup.ts`):
   - Manages extension popup UI
   - Handles search and clear operations
   - Communicates with content script

3. **Background Script** (`background.ts`):
   - Handles keyboard shortcuts
   - Manages extension lifecycle

### Key Features

- **Type Safety**: Full TypeScript coverage with strict type checking
- **Modern ES2020**: Uses modern JavaScript features with proper polyfills
- **Event Coordination**: Smart handling of scroll/mouse interactions
- **Error Handling**: Comprehensive error handling and recovery
- **Performance Optimized**: Efficient DOM operations and event throttling

## 🔧 Configuration

### TypeScript Configuration (`tsconfig.json`)

- **Target**: ES2020 for modern browser features
- **Strict Mode**: Full TypeScript strict checking enabled
- **Source Maps**: Enabled for debugging
- **Declaration Files**: Generated for better IDE support

### Build Configuration

- Compiles TypeScript to `dist/` directory
- Preserves source maps for debugging
- Maintains file structure for Chrome extension requirements

## 🚀 Usage

1. **Highlighting Text**:
   - Select text and press `Alt+H`
   - Or double-click on text
   - Or select text and use the popup interface

2. **Searching Text**:
   - Open the extension popup
   - Enter search term in the search box
   - Click "Search" or press Enter

3. **Clearing Highlights**:
   - Press `Alt+Shift+C` for current page
   - Use popup buttons for more options

## 🐛 Troubleshooting

### Common Issues

1. **Highlights not appearing**:
   - Ensure you're on a `notion.so` page
   - Check browser console for errors
   - Try refreshing the page

2. **TypeScript compilation errors**:
   - Run `npm install` to ensure dependencies are installed
   - Check TypeScript version compatibility
   - Verify `tsconfig.json` settings

3. **Extension not loading**:
   - Ensure `dist/` directory exists and contains compiled files
   - Check manifest.json points to correct file paths
   - Verify Chrome extensions developer mode is enabled

### Development Debugging

- **Source Maps**: Enabled for debugging TypeScript in browser dev tools
- **Console Logging**: Comprehensive logging for state changes and errors
- **Type Checking**: Run `npx tsc --noEmit` to check types without compilation

## 📝 Code Quality

- **ESLint Ready**: TypeScript configuration supports ESLint integration
- **Strict Types**: Full type safety with strict TypeScript settings
- **Modern Syntax**: Uses ES2020 features like optional chaining and nullish coalescing
- **Clean Architecture**: Well-organized class-based structure with clear separation of concerns

## 🔄 Migration from JavaScript

The extension has been fully migrated from JavaScript to TypeScript:

- ✅ **Type Safety**: All variables, functions, and APIs are properly typed
- ✅ **Modern Classes**: Refactored to use ES2020 class syntax
- ✅ **Interface Definitions**: Clear contracts for data structures
- ✅ **Error Handling**: Improved error handling with type-safe patterns
- ✅ **IDE Support**: Full IntelliSense and autocomplete support
- ✅ **Maintainability**: Better code organization and documentation

## 📄 License

MIT License - feel free to modify and distribute.

---

Built with ❤️ and TypeScript for better Notion highlighting experience!