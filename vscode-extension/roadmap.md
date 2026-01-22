# C-Next VS Code Extension Roadmap

This document tracks planned features and improvements for the C-Next VS Code extension.

## Current Features

- **Syntax highlighting** - TextMate grammar for `.cnx` files
- **Live C preview** - Side-by-side transpilation view
- **Diagnostics** - Parse errors shown as squiggles
- **Auto-completion** - Keywords, types, symbols, C/C++ stdlib via generated files
- **Hover info** - Types, keywords, symbols, C library documentation
- **Go-to-definition** - Navigate to symbol definitions (Ctrl+Click / F12)
- **Workspace indexing** - Cross-file symbol resolution
- **File nesting** - Generated files (.c, .cpp, .h, .hpp) collapsed under .cnx files
- **Formatter defaults** - Auto-configures Prettier as default formatter for .cnx files
- **Code snippets** - Templates for scope, register, struct, enum, loops, functions, etc.

## Planned Features

### Medium Priority

#### Document Outline / Symbols

Implement `DocumentSymbolProvider` to show file structure in the Outline view:

- Scopes, registers, structs, enums at top level
- Functions and methods nested under their containers
- Fields and members nested under their parents

Enables:

- Outline view in Explorer sidebar
- "Go to Symbol in Editor" (Cmd+Shift+O)
- Breadcrumb navigation

**Effort:** Medium | **Impact:** High

#### Rename Symbol

Implement `RenameProvider` for safe refactoring:

- Rename variables, functions, types across the file
- Workspace-wide rename using WorkspaceIndex
- Preview changes before applying

**Effort:** Medium | **Impact:** High

#### Find All References

Implement `ReferenceProvider`:

- Find all usages of a symbol
- Works across workspace using WorkspaceIndex
- Integrates with "Find All References" (Shift+F12)

**Effort:** Medium | **Impact:** Medium

#### Signature Help

Implement `SignatureHelpProvider`:

- Show parameter hints while typing function calls
- Display parameter types and names
- Highlight current parameter

**Effort:** Medium | **Impact:** Medium

### Lower Priority

#### Code Actions / Quick Fixes

Implement `CodeActionProvider` for common fixes:

- "Did you mean `u32` instead of `uint32`?" (type suggestions)
- "Add missing return statement"
- "Convert to scope member" (add `this.` prefix)
- Import suggestions for cross-file symbols

**Effort:** High | **Impact:** Medium

#### Semantic Highlighting

Implement `DocumentSemanticTokensProvider`:

- More accurate syntax coloring based on actual parsing
- Distinguish between types, variables, functions by context
- Highlight scope members differently from globals

**Effort:** High | **Impact:** Low-Medium

#### Workspace Symbol Search

Implement `WorkspaceSymbolProvider`:

- "Go to Symbol in Workspace" (Cmd+T)
- Search for symbols across all .cnx files
- Leverage existing WorkspaceIndex

**Effort:** Low | **Impact:** Medium

## Ideas for Future Consideration

- **Inlay hints** - Show inferred types, parameter names inline
- **Call hierarchy** - "Who calls this?" / "What does this call?"
- **Code lens** - Show reference counts above functions
- **Folding ranges** - Custom folding for scopes, registers, multi-line comments
- **Linked editing** - Edit matching identifiers simultaneously
- **Color decorators** - Preview hex colors in register definitions
- **Problem matchers** - Parse C compiler output for .cnx line mapping
- **Debug adapter** - Source-level debugging (maps to generated C)
- **Test integration** - Run .test.cnx files from VS Code

## Contributing

When implementing a feature:

1. Update this roadmap to mark it as in-progress
2. Add tests where applicable
3. Update the extension's README with new features
4. Bump the version in package.json
