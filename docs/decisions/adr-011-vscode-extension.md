# ADR-011: VS Code Extension with Live C Preview

**Status:** Implemented
**Date:** 2025-12-27
**Decision Makers:** C-Next Language Design Team

## Context

During development, the ability to see C-Next source alongside its generated C output has proven invaluable. Currently this requires:

1. Writing `.cnx` code
2. Running the transpiler manually
3. Opening the generated `.c` file
4. Switching between windows to compare

This friction slows the feedback loop and makes it harder to understand how C-Next constructs map to C output.

### Inspiration: VS Code Markdown Preview

VS Code's markdown extension provides an excellent UX pattern:

- Edit markdown on the left
- See rendered output on the right
- Updates live as you type
- Single keystroke to toggle preview

**Why not apply this pattern to C-Next?**

---

## Decision: VS Code Extension with Split-Pane Preview

Create a VS Code extension that provides:

1. **Syntax highlighting** for `.cnx` files
2. **Live preview pane** showing generated C code
3. **Side-by-side editing** (CNX left, C right)

```
┌─────────────────────────────────────────────────────────────┐
│  blink.cnx                          │  [Generated C]        │
├─────────────────────────────────────┼───────────────────────┤
│  register GPIO7 @ 0x42004000 {      │  #define GPIO7_DR ... │
│      DR: u32 rw @ 0x00,             │  #define GPIO7_DR_SET │
│      DR_SET: u32 wo @ 0x84,         │                       │
│  }                                  │  uint32_t LED_BIT = 3;│
│                                     │                       │
│  u32 LED_BIT <- 3;                  │  void LED_toggle() {  │
│                                     │      GPIO7_DR_TOGGLE  │
│  namespace LED {                    │        = (1 << LED_BIT│
│      void toggle() {                │      );               │
│          GPIO7.DR_TOGGLE[LED_BIT]   │  }                    │
│            <- true;                 │                       │
│      }                              │                       │
│  }                                  │                       │
└─────────────────────────────────────┴───────────────────────┘
```

---

## Architecture

### Transpiler as Library

Refactor the current CLI-based transpiler to be usable as a library:

```
src/
├── lib/
│   └── transpiler.ts      # Core transpilation API
├── cli/
│   └── index.ts           # CLI wrapper (uses lib)
└── ...

vscode-extension/
├── src/
│   └── extension.ts       # VS Code extension (uses lib)
└── ...
```

**Library API:**

```typescript
// src/lib/transpiler.ts
export interface TranspileResult {
  success: boolean;
  code?: string; // Generated C code
  errors?: TranspileError[];
}

export interface TranspileError {
  line: number;
  column: number;
  message: string;
}

export function transpile(source: string): TranspileResult;
```

### Extension Structure

```
vscode-extension/
├── package.json              # Extension manifest
├── syntaxes/
│   └── cnext.tmLanguage.json # TextMate grammar for highlighting
├── src/
│   ├── extension.ts          # Extension entry point
│   └── previewProvider.ts    # Webview panel for C output
├── media/
│   └── preview.css           # Styling for preview pane
└── tsconfig.json
```

---

## Implementation Phases

### Phase 1: Syntax Highlighting

1. Create TextMate grammar (`cnext.tmLanguage.json`)
2. Define scopes for:
   - Keywords (`register`, `namespace`, `void`, types)
   - Operators (`<-`, `@`)
   - Literals (numbers, strings, booleans)
   - Comments
3. Register `.cnx` file association

### Phase 2: Refactor Transpiler to Library

1. Extract core logic from `src/index.ts`
2. Create `src/lib/transpiler.ts` with clean API
3. Update CLI to use library
4. Add error recovery (return partial results on parse errors)
5. Ensure library works in both Node.js and bundled extension

### Phase 3: Preview Provider

1. Create Webview panel for C output
2. Implement `CNextPreviewProvider` class
3. Register preview command (like markdown: "Open Preview to the Side")
4. Style C output with syntax highlighting (use Prism.js or similar)

### Phase 4: Live Updates

1. Listen to `onDidChangeTextDocument` events
2. Debounce updates (~300ms)
3. Re-transpile on each change
4. Update preview pane with new output
5. Show last successful output when errors occur

### Phase 5: Error Handling

1. Parse errors → VS Code Diagnostics (Problems panel)
2. Show error indicators in editor (red squiggles)
3. Preview pane shows last good output + error banner
4. Clear errors when fixed

---

## User Experience

### Commands

| Command                            | Keybinding     | Description                      |
| ---------------------------------- | -------------- | -------------------------------- |
| `C-Next: Open Preview to the Side` | `Ctrl+K V`     | Open C preview beside editor     |
| `C-Next: Open Preview`             | `Ctrl+Shift+V` | Open C preview in current column |
| `C-Next: Toggle Preview`           | —              | Toggle preview visibility        |

### Settings

```json
{
  "cnext.preview.updateDelay": 300,
  "cnext.preview.showLineNumbers": true,
  "cnext.preview.theme": "auto"
}
```

### Status Bar

- Show transpile status: "C-Next: Ready" / "C-Next: Error"
- Click to open Problems panel

---

## Error Handling Strategy

When C-Next source has syntax errors:

1. **Editor**: Red squiggly underlines at error locations
2. **Problems Panel**: Full error messages with line/column
3. **Preview Pane**:
   - Header shows "⚠ Parse Error" banner
   - Body shows last successful transpilation
   - Errors don't blank out the preview

This keeps the preview useful while editing incomplete code.

---

## Future Enhancements

### Assembly View (Phase 6+)

Add a third pane showing assembly output:

```
┌───────────────┬───────────────┬───────────────┐
│   C-Next      │   Generated C │   Assembly    │
├───────────────┼───────────────┼───────────────┤
│  ...          │  ...          │  LED_toggle:  │
│               │               │    ldr r0, =  │
│               │               │    mov r1, #1 │
│               │               │    lsl r1, r1 │
│               │               │    str r1, [r0│
└───────────────┴───────────────┴───────────────┘
```

**Implementation Options:**

1. **Local toolchain**: Invoke `arm-none-eabi-gcc -S` (requires user setup)
2. **Compiler Explorer API**: Use godbolt.org API (requires internet)
3. **PlatformIO integration**: Use active environment's toolchain

**Architecture Selection:**

- Read from `platformio.ini` if available
- Or VS Code setting: `cnext.assembly.architecture`
- Common targets: ARM Cortex-M4, AVR, x86-64

### Language Server Protocol (LSP)

- Go to definition
- Find references
- Hover documentation
- Autocomplete for register members

### Debugging Integration

- Source maps: C-Next line → C line → Assembly
- Breakpoints in C-Next that work in C debugger

---

## Trade-offs

### Advantages

1. **Immediate feedback** — See C output as you type
2. **Learning tool** — Understand how C-Next maps to C
3. **Debugging aid** — Verify generated code is correct
4. **Low friction** — No manual transpile step needed
5. **Standard UX** — Familiar markdown preview pattern

### Disadvantages

1. **Extension maintenance** — Another artifact to maintain
2. **Bundling complexity** — Transpiler must work in VS Code context
3. **Performance** — Re-transpiling on every keystroke (mitigated by debounce)

---

## Technical Considerations

### Bundling the Transpiler

The transpiler uses ANTLR4, which is a significant dependency. Options:

1. **Bundle with esbuild/webpack** — Include transpiler in extension
2. **Separate process** — Extension spawns transpiler CLI
3. **WASM** — Compile parser to WebAssembly (future optimization)

For MVP, option 1 (bundling) is simplest and provides best latency.

### Webview Security

VS Code Webviews have strict CSP. The preview pane must:

- Use VS Code's built-in theming
- Not load external resources
- Use nonces for inline scripts

---

## Success Criteria

1. `.cnx` files have proper syntax highlighting in VS Code
2. "Open Preview to the Side" shows generated C code
3. Preview updates within 500ms of typing
4. Parse errors appear in Problems panel
5. Extension installs from `.vsix` file
6. Works on Linux (primary), macOS, Windows

---

## References

### VS Code Extension Development

- [Extension API](https://code.visualstudio.com/api)
- [Webview Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [Language Extensions](https://code.visualstudio.com/api/language-extensions/overview)
- [TextMate Grammars](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)

### Example Extensions

- [Markdown Preview](https://github.com/microsoft/vscode/tree/main/extensions/markdown-language-features)
- [AsciiDoc](https://github.com/asciidoctor/asciidoctor-vscode)
- [PlantUML](https://github.com/qjebbs/vscode-plantuml)

### Syntax Highlighting

- [TextMate Language Grammars](https://macromates.com/manual/en/language_grammars)
- [Prism.js](https://prismjs.com/) — For highlighting in Webview
