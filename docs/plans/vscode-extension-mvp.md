# VS Code Extension MVP Implementation Plan

**Goal:** Syntax highlighting + live C preview for `.cnx` files
**Reference:** [ADR-011](../decisions/adr-011-vscode-extension.md)

---

## Phase 1: Project Setup

### 1.1 Create Extension Scaffold
- [ ] Create `vscode-extension/` directory
- [ ] Initialize with `yo code` or manual setup
- [ ] Configure `package.json` with:
  - Extension name: `c-next`
  - Display name: `C-Next`
  - Publisher (can use personal)
  - Activation events: `onLanguage:cnext`
  - File associations: `.cnx` → `cnext`
- [ ] Set up TypeScript configuration
- [ ] Add `.vscodeignore` for clean packaging

### 1.2 Build Configuration
- [ ] Configure esbuild/webpack for bundling
- [ ] Set up npm scripts:
  - `npm run compile` — Build extension
  - `npm run watch` — Watch mode for development
  - `npm run package` — Create `.vsix` file
- [ ] Test extension loads in VS Code Extension Host

---

## Phase 2: Syntax Highlighting

### 2.1 TextMate Grammar
- [ ] Create `syntaxes/cnext.tmLanguage.json`
- [ ] Define language scopes:

```json
{
  "scopeName": "source.cnext",
  "patterns": [
    { "include": "#comments" },
    { "include": "#keywords" },
    { "include": "#types" },
    { "include": "#operators" },
    { "include": "#literals" },
    { "include": "#registers" }
  ],
  "repository": {
    "keywords": {
      "match": "\\b(register|namespace|void|if|else|for|while|return|true|false)\\b",
      "name": "keyword.control.cnext"
    },
    "types": {
      "match": "\\b(u8|u16|u32|u64|i8|i16|i32|i64|f32|f64|bool)\\b",
      "name": "storage.type.cnext"
    },
    "operators": {
      "match": "<-|@",
      "name": "keyword.operator.cnext"
    }
  }
}
```

### 2.2 Language Configuration
- [ ] Create `language-configuration.json`
- [ ] Configure:
  - Comment tokens (`//`, `/* */`)
  - Bracket pairs
  - Auto-closing pairs
  - Folding regions

### 2.3 Register Language
- [ ] Add `contributes.languages` to `package.json`
- [ ] Add `contributes.grammars` to `package.json`
- [ ] Test: Open `.cnx` file, verify highlighting works

---

## Phase 3: Transpiler Library Refactor

### 3.1 Extract Core API
- [ ] Create `src/lib/transpiler.ts`
- [ ] Define interfaces:
  ```typescript
  export interface TranspileResult {
      success: boolean;
      code?: string;
      errors?: TranspileError[];
  }

  export interface TranspileError {
      line: number;
      column: number;
      message: string;
  }

  export function transpile(source: string): TranspileResult;
  ```
- [ ] Move parsing logic from `index.ts` to library
- [ ] Move code generation logic to library
- [ ] Add error recovery (catch parse errors, return partial results)

### 3.2 Update CLI
- [ ] Refactor `src/index.ts` to use library
- [ ] Verify CLI still works: `node dist/index.js examples/blink.cnx`
- [ ] Ensure no breaking changes to CLI behavior

### 3.3 Export for Extension
- [ ] Ensure library exports are accessible
- [ ] Test importing library from another TypeScript file
- [ ] Verify ANTLR runtime works when bundled

---

## Phase 4: Preview Provider

### 4.1 Webview Panel
- [ ] Create `src/previewProvider.ts`
- [ ] Implement `CNextPreviewProvider` class:
  ```typescript
  class CNextPreviewProvider implements vscode.WebviewPanelSerializer {
      public static readonly viewType = 'cnext.preview';

      public createPreview(document: vscode.TextDocument): void;
      public updatePreview(document: vscode.TextDocument): void;
      private getWebviewContent(cCode: string): string;
  }
  ```
- [ ] Create HTML template for preview
- [ ] Add C syntax highlighting in preview (basic CSS or Prism.js)
- [ ] Handle VS Code theming (light/dark mode)

### 4.2 Register Commands
- [ ] Add `contributes.commands` to `package.json`:
  - `cnext.openPreview` — Open preview in current column
  - `cnext.openPreviewToSide` — Open preview beside editor
- [ ] Implement command handlers in `extension.ts`
- [ ] Add keybindings:
  - `Ctrl+Shift+V` → `cnext.openPreview`
  - `Ctrl+K V` → `cnext.openPreviewToSide`

### 4.3 Link Preview to Editor
- [ ] Track active `.cnx` editor
- [ ] Update preview when active editor changes
- [ ] Handle editor close (close or keep preview?)

---

## Phase 5: Live Updates

### 5.1 Document Change Listener
- [ ] Subscribe to `vscode.workspace.onDidChangeTextDocument`
- [ ] Filter for `.cnx` files only
- [ ] Implement debounce (300ms default)
- [ ] Re-transpile on change
- [ ] Update webview with new content

### 5.2 Error Display
- [ ] Create `DiagnosticCollection` for C-Next errors
- [ ] Map `TranspileError` to `vscode.Diagnostic`
- [ ] Show errors in Problems panel
- [ ] Show inline squiggles in editor

### 5.3 Preview Error State
- [ ] When transpile fails:
  - Show error banner in preview header
  - Keep last successful output in preview body
- [ ] When transpile succeeds:
  - Remove error banner
  - Update preview content
- [ ] Clear errors when they're fixed

---

## Phase 6: Polish & Packaging

### 6.1 User Settings
- [ ] Add `contributes.configuration` to `package.json`:
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
- [ ] Read settings in preview provider

### 6.2 Status Bar
- [ ] Add status bar item showing transpile status
- [ ] "C-Next: Ready" when successful
- [ ] "C-Next: Error" when parse fails (clickable → Problems)

### 6.3 Testing
- [ ] Test on Linux (primary)
- [ ] Test on macOS if available
- [ ] Test on Windows if available
- [ ] Test with various `.cnx` examples
- [ ] Test error recovery with intentionally broken code

### 6.4 Package Extension
- [ ] Run `vsce package` to create `.vsix`
- [ ] Install locally: `code --install-extension c-next-0.1.0.vsix`
- [ ] Verify all features work in installed extension
- [ ] Document installation in README

---

## File Structure (Final)

```
c-next/
├── src/
│   ├── lib/
│   │   └── transpiler.ts       # Core transpilation API
│   ├── cli/
│   │   └── index.ts            # CLI entry point
│   ├── codegen/
│   │   └── CodeGenerator.ts    # Existing code generator
│   └── parser/                  # Generated ANTLR parser
│
├── vscode-extension/
│   ├── package.json             # Extension manifest
│   ├── tsconfig.json
│   ├── esbuild.js               # Bundle configuration
│   ├── syntaxes/
│   │   └── cnext.tmLanguage.json
│   ├── language-configuration.json
│   ├── src/
│   │   ├── extension.ts         # Extension entry
│   │   └── previewProvider.ts   # Webview logic
│   └── media/
│       └── preview.css          # Preview styling
│
└── docs/
    ├── decisions/
    │   └── adr-011-vscode-extension.md
    └── plans/
        └── vscode-extension-mvp.md   # This file
```

---

## Success Checklist

- [ ] `.cnx` files have syntax highlighting
- [ ] `Ctrl+K V` opens C preview to the side
- [ ] Preview updates within 500ms of typing
- [ ] Parse errors show in Problems panel
- [ ] Parse errors show as squiggles in editor
- [ ] Preview shows last good output on error
- [ ] Extension installs from `.vsix` file
- [ ] Works on Linux

---

## Dependencies

**Development:**
- `@types/vscode` — VS Code API types
- `esbuild` — Bundler
- `@vscode/vsce` — Extension packaging

**Runtime (bundled):**
- `antlr4ng` — Parser runtime (from main project)
- Transpiler library (from main project)

---

## Notes

- Start simple, iterate
- Assembly view is documented as future enhancement in ADR-011
- PlatformIO integration for architecture selection is future scope
- LSP support is a separate future project
