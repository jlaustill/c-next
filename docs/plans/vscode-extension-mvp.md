# VS Code Extension MVP Implementation Plan

**Goal:** Syntax highlighting + live C preview for `.cnx` files
**Reference:** [ADR-011](../decisions/adr-011-vscode-extension.md)
**Status:** Complete (v0.3.0)

---

## Phase 1: Project Setup

### 1.1 Create Extension Scaffold
- [x] Create `vscode-extension/` directory
- [x] Initialize with manual setup
- [x] Configure `package.json` with:
  - Extension name: `c-next`
  - Display name: `C-Next`
  - Publisher: `jlaustill`
  - Activation events: `onLanguage:cnext`
  - File associations: `.cnx` → `cnext`
- [x] Set up TypeScript configuration
- [x] Add `.vscodeignore` for clean packaging

### 1.2 Build Configuration
- [x] Configure esbuild for bundling
- [x] Set up npm scripts:
  - `npm run compile` — Build extension
  - `npm run watch` — Watch mode for development
  - `npm run package` — Create `.vsix` file
- [x] Test extension loads in VS Code Extension Host

---

## Phase 2: Syntax Highlighting

### 2.1 TextMate Grammar
- [x] Create `syntaxes/cnext.tmLanguage.json`
- [x] Define language scopes for:
  - Comments (line and block)
  - Preprocessor directives
  - Keywords (control flow, declarations)
  - Types (u8, u16, u32, etc.)
  - Operators (`<-`, `@`, comparison, logical, bitwise)
  - Literals (boolean, hex, binary, decimal)
  - Strings
  - Register access modifiers (rw, ro, wo, w1c, w1s)

### 2.2 Language Configuration
- [x] Create `language-configuration.json`
- [x] Configure:
  - Comment tokens (`//`, `/* */`)
  - Bracket pairs
  - Auto-closing pairs
  - Folding regions

### 2.3 Register Language
- [x] Add `contributes.languages` to `package.json`
- [x] Add `contributes.grammars` to `package.json`
- [x] Test: Open `.cnx` file, verify highlighting works

---

## Phase 3: Transpiler Library Refactor

### 3.1 Extract Core API
- [x] Create `src/lib/transpiler.ts`
- [x] Define interfaces:
  ```typescript
  export interface ITranspileResult {
      success: boolean;
      code: string;
      errors: ITranspileError[];
  }

  export interface ITranspileError {
      line: number;
      column: number;
      message: string;
      severity: 'error' | 'warning';
  }

  export function transpile(source: string, options?: ITranspileOptions): ITranspileResult;
  ```
- [x] Move parsing logic from `index.ts` to library
- [x] Move code generation logic to library
- [x] Add error recovery (catch parse errors, return partial results)

### 3.2 Update CLI
- [x] Refactor `src/index.ts` to use library
- [x] Verify CLI still works: `node dist/index.js examples/blink.cnx`
- [x] Ensure no breaking changes to CLI behavior

### 3.3 Export for Extension
- [x] Ensure library exports are accessible
- [x] Test importing library from another TypeScript file
- [x] Verify ANTLR runtime works when bundled

---

## Phase 4: Preview Provider

### 4.1 Webview Panel
- [x] Create `src/previewProvider.ts`
- [x] Implement `PreviewProvider` class (singleton pattern)
- [x] Create HTML template for preview
- [x] Add C syntax highlighting in preview (custom CSS-based)
- [x] Handle VS Code theming (light/dark/high-contrast auto-detected)

### 4.2 Register Commands
- [x] Add `contributes.commands` to `package.json`:
  - `cnext.openPreview` — Open preview in current column
  - `cnext.openPreviewToSide` — Open preview beside editor
- [x] Implement command handlers in `extension.ts`
- [x] Add keybindings:
  - `Ctrl+Shift+V` → `cnext.openPreview`
  - `Ctrl+K V` → `cnext.openPreviewToSide`
- [x] Add editor title menu button for `.cnx` files

### 4.3 Link Preview to Editor
- [x] Track active `.cnx` editor
- [x] Update preview when active editor changes
- [x] Handle editor close (preview persists, can track new `.cnx` file)

---

## Phase 5: Live Updates

### 5.1 Document Change Listener
- [x] Subscribe to `vscode.workspace.onDidChangeTextDocument`
- [x] Filter for `.cnx` files only
- [x] Implement debounce (300ms default, configurable)
- [x] Re-transpile on change
- [x] Update webview with new content

### 5.2 Error Display
- [x] Create `DiagnosticCollection` for C-Next errors
- [x] Map `ITranspileError` to `vscode.Diagnostic`
- [x] Show errors in Problems panel
- [x] Show inline squiggles in editor
- [x] Highlight error token (word boundary detection)

### 5.3 Preview Error State
- [x] When transpile fails:
  - Show error banner in preview header
  - Keep last successful output in preview body
- [x] When transpile succeeds:
  - Remove error banner
  - Update preview content
- [x] Clear errors when they're fixed

---

## Phase 6: Polish & Packaging

### 6.1 User Settings
- [x] Add `contributes.configuration` to `package.json`:
  ```json
  {
    "cnext.preview.updateDelay": {
      "type": "number",
      "default": 300,
      "description": "Delay in ms before updating preview"
    },
    "cnext.preview.showLineNumbers": {
      "type": "boolean",
      "default": true
    }
  }
  ```
- [x] Read settings in preview provider

### 6.2 Status Bar
- [x] Add status bar item showing transpile status
- [x] `$(check) C-Next` when successful
- [x] `$(error) C-Next: N errors` when parse fails (clickable → Problems)

### 6.3 Testing
- [x] Test on Linux (primary)
- [ ] Test on macOS if available
- [ ] Test on Windows if available
- [x] Test with various `.cnx` examples
- [x] Test error recovery with intentionally broken code

### 6.4 Package Extension
- [x] Run `vsce package` to create `.vsix`
- [x] Install locally: `code --install-extension c-next-0.3.0.vsix`
- [x] Verify all features work in installed extension
- [x] Document installation in README

---

## Phase 7: IntelliSense Features (v0.3.0)

### 7.1 Symbol API
- [x] Add `ISymbolInfo` interface to transpiler types
- [x] Add `parseWithSymbols()` function to transpiler
- [x] Use existing `CNextSymbolCollector` for symbol extraction
- [x] Transform symbols to simplified format for extension use

### 7.2 Autocomplete Provider
- [x] Create `src/completionProvider.ts`
- [x] Implement context detection:
  - After `.` for member access (namespace, register, class members)
  - Type contexts (after `:` in register member)
  - Global scope (keywords, types, top-level symbols)
- [x] Register provider with `.` as trigger character
- [x] Include C-Next keywords and primitive types
- [x] Show symbol kind icons and type info

### 7.3 Hover Provider
- [x] Create `src/hoverProvider.ts`
- [x] Show type info for symbols:
  - Functions: signature and parent namespace/class
  - Variables: type and size
  - Register members: type and access modifier (rw/ro/wo)
- [x] Show info for primitive types and keywords
- [x] Display line number and location

### 7.4 Scroll Sync
- [x] Add `scrollToLine()` method to PreviewProvider
- [x] Add `data-line` attributes to generated HTML lines
- [x] Add JavaScript message handler in webview
- [x] Listen to `onDidChangeTextEditorSelection` events
- [x] Highlight current line in preview
- [x] Smooth scroll behavior

---

## File Structure (Final)

```
c-next/
├── src/
│   ├── lib/
│   │   ├── transpiler.ts           # Core transpilation API
│   │   └── types/
│   │       └── ITranspileResult.ts # Includes ISymbolInfo
│   ├── symbols/
│   │   └── CNextSymbolCollector.ts # Symbol extraction
│   ├── index.ts                    # CLI entry point
│   ├── codegen/
│   │   └── CodeGenerator.ts        # Code generator
│   └── parser/                     # Generated ANTLR parser
│
├── vscode-extension/
│   ├── package.json                # Extension manifest (v0.3.0)
│   ├── tsconfig.json
│   ├── syntaxes/
│   │   └── cnext.tmLanguage.json
│   ├── language-configuration.json
│   ├── src/
│   │   ├── extension.ts            # Extension entry
│   │   ├── previewProvider.ts      # Webview logic + scroll sync
│   │   ├── completionProvider.ts   # Autocomplete (v0.3.0)
│   │   └── hoverProvider.ts        # Hover info (v0.3.0)
│   └── c-next-0.3.0.vsix           # Current package
│
└── docs/
    ├── decisions/
    │   └── adr-011-vscode-extension.md
    └── plans/
        └── vscode-extension-mvp.md # This file
```

---

## Success Checklist

### MVP (v0.2.0)
- [x] `.cnx` files have syntax highlighting
- [x] `Ctrl+K V` opens C preview to the side
- [x] Preview updates within 500ms of typing
- [x] Parse errors show in Problems panel
- [x] Parse errors show as squiggles in editor
- [x] Preview shows last good output on error
- [x] Extension installs from `.vsix` file
- [x] Works on Linux

### IntelliSense (v0.3.0)
- [x] Type `LED.` → shows `on`, `off`, `toggle`, `isOn` only
- [x] Type `GPIO7.` → shows register members only
- [x] Type `u` → shows `u8`, `u16`, `u32`, `u64` types
- [x] Hover over `toggle` in `LED.toggle()` → shows function info
- [x] Hover over `DR_SET` → shows register member with access mode
- [x] Click in source → preview scrolls to corresponding C code
- [x] Works with incomplete/errored code (mid-typing)

---

## Dependencies

**Development:**
- `@types/vscode` — VS Code API types
- `esbuild` — Bundler
- `@vscode/vsce` — Extension packaging
- `typescript` — TypeScript compiler

**Runtime (bundled):**
- `antlr4ng` — Parser runtime (from main project)
- Transpiler library (from main project)

---

## Notes

- MVP complete as of 2025-12-27
- IntelliSense features (v0.3.0) complete as of 2025-12-28
- Assembly view documented as future enhancement in ADR-011
- PlatformIO integration for architecture selection is future scope
- Full LSP server is a separate future project (current features use VS Code providers directly)
