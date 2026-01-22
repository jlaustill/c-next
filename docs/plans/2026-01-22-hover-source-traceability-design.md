# Hover Tooltip Source Traceability

**Date:** 2026-01-22
**Status:** Ready for Implementation

## Summary

Enhance VS Code extension hover tooltips to show the language type (C/C++/C-Next) and source filename for every symbol, providing full traceability when working across C-Next source, generated C, and C/C++ dependencies.

## Motivation

When working in a C-Next project, it's not always obvious where a symbol comes from:

- Is this a C-Next symbol from my `.cnx` file?
- Is this from a C header I included?
- Is this from an Arduino C++ library?

Adding source traceability to hover tooltips answers these questions instantly.

## Design

### Tooltip Format

Append a footer line after existing hover content:

```
[existing symbol info - type, signature, description]

---
Source: [filename.ext:line](file-link) (Language (.ext))
```

### Examples

**C-Next scope method:**

```
void LED_toggle(void)
Toggle the LED state

---
Source: [led.cnx:42](command:...) (C-Next (.cnx))
```

**C standard library function:**

```
int printf(const char *format, ...)
Prints formatted output to stdout

---
Source: [stdio.h:152](command:...) (C (.h))
```

**Arduino C++ symbol:**

```
void Serial.begin(unsigned long baud)

---
Source: [HardwareSerial.h:89](command:...) (C++ (.h))
```

### Language Detection

| File Extension        | Language Label       |
| --------------------- | -------------------- |
| `.cnx`                | C-Next (.cnx)        |
| `.c`                  | C (.c)               |
| `.h`                  | C (.h) or C++ (.h)\* |
| `.cpp`, `.cc`, `.cxx` | C++ (.cpp)           |
| `.hpp`, `.hh`         | C++ (.hpp)           |

\*For `.h` files, detect C++ by checking for C++ constructs (classes, templates, namespaces) or known C++ paths (Arduino libraries).

### Smart Path Display

1. Collect all indexed filenames
2. If filename is unique → show just filename (e.g., `led.cnx`)
3. If duplicates exist → show relative path (e.g., `src/drivers/led.cnx`)

### Symbol Source Tracking

| Symbol Origin            | Source of File/Line                                  |
| ------------------------ | ---------------------------------------------------- |
| C-Next symbols           | `ISymbolInfo.line` + file from WorkspaceIndex        |
| C/C++ from headers       | Parsed via `CSymbolCollector`, line numbers captured |
| C/C++ extension fallback | Query C/C++ extension's definition provider          |

### Clickable Links

Use VS Code command links in markdown:

```markdown
[led.cnx:42](command:vscode.open?${encodedArgs})
```

Clicking opens the file and jumps to the specified line.

## Implementation

### Files to Modify

1. **`vscode-extension/src/hoverProvider.ts`**
   - Add `formatSourceFooter(filePath, line, language)` helper
   - Add `detectLanguage(filePath, content?)` helper
   - Add `getSmartDisplayPath(filePath)` helper
   - Modify all hover result paths to append footer

2. **`vscode-extension/src/workspace/WorkspaceIndex.ts`**
   - Add `hasFilenameConflict(filename)` method
   - Ensure source file path is tracked for all symbols

3. **`vscode-extension/src/lib/types/ISymbolInfo.ts`**
   - Add `sourceFile?: string` field (if not present)
   - Add `language?: 'cnext' | 'c' | 'cpp'` field

### Implementation Steps

1. Extend `ISymbolInfo` with source tracking fields
2. Update symbol collectors to populate source file paths
3. Add helper functions to `hoverProvider.ts`
4. Modify C-Next symbol hover to include footer
5. Modify C/C++ header symbol hover to include footer
6. Modify C/C++ extension fallback hover to include footer
7. Test across all symbol types

## Out of Scope

- Hover for symbols that can't be resolved to a source file (built-in types, keywords)
- Custom styling/colors (VS Code hover markdown is limited)
