# ADR-053: Transpiler Pipeline Architecture

## Status

**Accepted**

## Critical Distinction: Transpiler vs Compiler

**C-Next is a transpiler, not a compiler.**

- **`.cnx` files** → Transpiled to `.c` files (this is the core function)
- **`.h`, `.c`, `.hpp`, `.cpp` files** → Parsed for symbols only (never modified)

C/C++ headers are read to extract type information (structs, enums, typedefs, macros) so that features like `.length` work correctly. But they are **passed through unchanged** - C-Next never modifies or regenerates C/C++ code.

```
Input Files:                    Output:
├── main.cnx      ─────────►    main.c (GENERATED)
├── utils.cnx     ─────────►    utils.c (GENERATED)
├── AppConfig.h   ─────────►    (unchanged, passed through)
└── vendor/lib.h  ─────────►    (unchanged, passed through)
```

## Research: How Other Compilers Handle This

### TypeScript Compiler (tsc)

**Source:** [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html), [Incremental Compilation](https://www.typescriptlang.org/tsconfig/incremental.html)

**Module Resolution:**

- Follows a strict order based on `tsconfig.json` settings
- Distinguishes relative imports (`./`, `../`) from non-relative imports
- Mirrors the runtime module resolver's behavior (Node.js, bundler, etc.)

**Incremental Compilation (`.tsbuildinfo`):**

- Saves project graph state to `.tsbuildinfo` file after successful builds
- On subsequent builds, determines which files changed and only recompiles those
- Stores dependency relationships between files
- Performance: One example shows 180s → 23s compile time with incremental enabled

**Key Insight:** TypeScript treats the compilation problem like a build system problem - track dependencies, cache results, invalidate minimally.

### Flow.js Type Checker

**Source:** [Flow Architecture](https://engineering.fb.com/2014/11/18/web/flow-a-new-static-type-checker-for-javascript/), [Types-First Architecture](https://medium.com/flow-type/types-first-a-scalable-new-architecture-for-flow-3d8c7ba1d4eb)

**Architecture:**

- Persistent server maintains semantic information in memory
- Processes files in dependency order (leaves first)
- Extracts "signatures" at module boundaries
- Result: 6x speedup in p90 rechecks at Facebook scale (10M+ lines)

**Key Insight:** Flow separates "signature extraction" from "code checking" - signatures can be cached and reused.

### GCC/Clang Preprocessor

**Source:** [GCC Preprocessor Options](https://gcc.gnu.org/onlinedocs/gcc/Preprocessor-Options.html)

**Dependency Tracking Flags:**

- `-M` / `-MM`: Output make-compatible dependency rules
- `-H`: Print include hierarchy with indentation showing depth
- `-MMD`: Generate dependencies as side-effect of compilation

**Key Insight:** GCC outputs dependency info for build tools (make). The compiler itself doesn't cache - that's delegated to the build system.

### Rust Compiler (rustc)

**Source:** [Rust Incremental Compilation](https://rustc-dev-guide.rust-lang.org/queries/incremental-compilation.html)

**Query-Based Architecture:**

- Compiler organized as queries with automatic dependency tracking
- Red-green algorithm marks nodes as unchanged/needs-recompute
- Fine-grained caching of intermediate results

**Key Insight:** Rust treats the compiler itself as a build system. However, this adds significant complexity.

### Architectural Approaches Comparison

| Approach                    | How It Works                                    | Examples   | Complexity         |
| --------------------------- | ----------------------------------------------- | ---------- | ------------------ |
| **Query-based**             | Automatic dependency tracking via query context | Rust       | High               |
| **Multi-pass + state-file** | Sequential passes, cache to file                | TypeScript | Medium             |
| **Build-system delegated**  | Output deps, let make/ninja cache               | GCC        | Low (for compiler) |
| **Server-based**            | Persistent process, in-memory state             | Flow.js    | High               |

### Recommendation for C-Next

**Multi-pass with state-file caching** (like TypeScript):

- Simple and proven approach
- State saved to `.cnx/` directory
- Timestamp-based cache invalidation
- No need for persistent server or complex query system

### Unified Pipeline (No Separate "Single File" Mode)

Currently, there are two code paths:

- `transpile()` in `src/lib/transpiler.ts` - Single file, no header parsing
- `Project` class in `src/project/Project.ts` - Multi-file with header parsing

**Decision: Unify these into a single pipeline.**

A "single file" transpilation is just a project with one `.cnx` file. The same pipeline runs regardless:

```
cnx transpile main.cnx     →  Source Discovery finds 1 file   →  main.c
cnx build src/             →  Source Discovery finds N files  →  N .c files
```

**How Source Discovery Works:**

| Input           | Source Discovery          | Result                                                 |
| --------------- | ------------------------- | ------------------------------------------------------ |
| `main.cnx`      | Single file detected      | `sourceFiles = ["main.cnx"]`                           |
| `src/`          | Recursive glob `**/*.cnx` | `sourceFiles = ["src/main.cnx", "src/utils.cnx", ...]` |
| `src/utils.cnx` | Single file detected      | `sourceFiles = ["src/utils.cnx"]`                      |

Benefits:

- One code path to maintain
- Consistent behavior everywhere (CLI, tests, VS Code extension)
- Headers always parsed, `.length` always works
- Caching benefits even single-file transpiles

The `--project` flag becomes unnecessary - the transpiler auto-discovers what needs to be processed based on the input type (file vs directory).

## Context

The C-Next transpiler needs to properly handle C/C++ header interoperability, including:

- C++11 typed enums (`enum Foo : uint8_t`)
- Struct field type information for `.length` property
- Macro constants from `#define`
- Nested includes

Currently, the simple transpiler (`src/lib/transpiler.ts`) processes only the source file without parsing included headers. This causes features like `.length` on C-header struct members to fail because the transpiler has no type information about those members.

The `Project` class does parse headers, but it's only used for multi-file project builds, not single-file transpilation used by tests and the VS Code extension.

## Problem Statement

When transpiling a C-Next file that includes a C/C++ header:

```cnx
#include "AppConfig.h"

u32 main() {
    AppConfig cfg;
    u8 len <- cfg.magic.length / 8;  // Should be 32/8 = 4, but generates 0/8 = 0
}
```

The transpiler doesn't know that `AppConfig.magic` is `uint32_t` (32 bits) because it never parsed `AppConfig.h`.

## Proposed Architecture

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        main() / CLI                              │
│  Input: main.cnx OR src/                                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    0. SOURCE DISCOVERY                           │
│  Input: File path OR directory path                              │
│  Output: Array of .cnx source files to transpile                 │
│                                                                  │
│  If input is a .cnx file:                                        │
│    → sourceFiles = [input]                                       │
│                                                                  │
│  If input is a directory:                                        │
│    → Recursively glob for **/*.cnx                               │
│    → sourceFiles = [all discovered .cnx files]                   │
│                                                                  │
│  Note: This step ONLY finds .cnx files to transpile.             │
│        C/C++ headers are discovered later by the preprocessor.   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              FOR EACH .cnx file in sourceFiles:                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. PREPROCESSOR                               │
│  Input: .cnx source file path                                    │
│  Output: Dependency tree (all included files, recursively)       │
│                                                                  │
│  - Parse #include directives in .cnx file                        │
│  - Resolve paths (use absolute paths as keys)                    │
│  - Recursively find includes in C/C++ headers                    │
│  - Detect language: C vs C++ (by content, e.g., typed enums)     │
│  - Skip system headers (use built-in knowledge instead)          │
│  - Build tree with no duplicates (absolute path = visited key)   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  2. SYMBOL COLLECTOR                             │
│  Input: Dependency tree (C/C++ headers only)                     │
│  Output: SymbolTable                                             │
│                                                                  │
│  For each C/C++ header (NOT .cnx files):                         │
│  - Parse with appropriate ANTLR parser (C or C++)                │
│  - Extract: structs, enums, typedefs, #define macros             │
│  - Populate SymbolTable with type info (field names, sizes)      │
│  - Process in dependency order (leaves first)                    │
│                                                                  │
│  Note: C/C++ files are READ-ONLY, never modified                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. TRANSPILER                                 │
│  Input: .cnx source + SymbolTable                                │
│  Output: Generated .c code                                       │
│                                                                  │
│  - Parse .cnx source with CNext ANTLR parser                     │
│  - Generate C code using CodeGenerator                           │
│  - Use SymbolTable to resolve types from C/C++ headers           │
│  - .length, sizeof, etc. now work for C-header types             │
│                                                                  │
│  ONLY .cnx files are transpiled to .c files                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. OUTPUT                                     │
│  Input: Generated C code                                         │
│  Output: .c file written to disk                                 │
│                                                                  │
│  - Write main.cnx → main.c                                       │
│  - C/C++ headers remain unchanged (just #include'd)              │
└─────────────────────────────────────────────────────────────────┘
```

### Preprocessor Details

The preprocessor builds a dependency tree by:

1. **Parsing includes**: Find all `#include "file.h"` and `#include <system.h>` directives
2. **Resolving paths**:
   - Quoted includes: relative to current file, then include paths
   - Angle-bracket includes: system include paths
3. **Detecting language**:
   - By extension: `.hpp`, `.hxx`, `.h++` → C++
   - By content: C++11 typed enums, `class`, `template` → C++
   - Default: C
4. **Building tree**: Each node contains:
   - File path
   - File content
   - Language (C or C++)
   - Child includes
5. **Handling guards**: Track `#ifndef`/`#define` guards to avoid processing duplicates

### Dependency Tree Structure

```typescript
interface IDependencyNode {
  filePath: string;
  content: string;
  language: "c" | "cpp" | "cnx";
  includes: IDependencyNode[];
  isSystemHeader: boolean;
}
```

### Symbol Collection Order

Files should be processed in reverse dependency order (leaves first) so that:

- Base types are known before types that use them
- Struct fields can reference previously-defined types

### C++11 Detection

A header is C++ if it contains any of:

- Typed enum: `enum\s+\w+\s*:\s*\w+\s*{`
- Class definition: `class\s+\w+`
- Template: `template\s*<`
- Namespace: `namespace\s+\w+`
- C++ keywords: `nullptr`, `constexpr`, `auto` (in certain contexts)

## Implementation Plan

1. **Source Discovery module** (`src/pipeline/`)
   - `SourceDiscovery.ts` - Determine input type (file vs directory)
   - If file: return single-element array
   - If directory: recursive glob for `**/*.cnx`
   - Return array of absolute paths to `.cnx` files

2. **Preprocessor module** (`src/preprocessor/`)
   - `IncludeResolver.ts` - Path resolution logic
   - `DependencyTreeBuilder.ts` - Build include tree
   - `LanguageDetector.ts` - Detect C vs C++

3. **Update transpiler.ts**
   - Accept `filePath` option
   - Call preprocessor to build dependency tree
   - Call symbol collectors for each header
   - Pass SymbolTable to CodeGenerator

4. **Update test framework**
   - Pass file path to transpiler
   - Compiler selection (gcc/g++) based on detected language

## Benefits

- `.length` property works for C-header struct members
- C++11 typed enums work seamlessly
- Macros from headers available during transpilation
- Clean separation of concerns
- Same code path for tests, CLI, and VS Code extension

## Alternatives Considered

### 1. Parse headers inline during code generation

Rejected: Mixes concerns, doesn't handle nested includes well.

### 2. Require manual type annotations in C-Next

Rejected: Defeats the purpose of header interop.

### 3. Only support C headers, not C++11

Rejected: C++11 typed enums are common in embedded systems (e.g., ESP32, STM32).

## Open Questions

1. ~~How to handle system headers (`<stdint.h>`) - parse them or use built-in knowledge?~~
2. ~~Should the dependency tree be cached for performance?~~
3. ~~How to handle circular includes (beyond include guards)?~~

## Decisions

### 1. System Headers: Built-in Knowledge

System headers like `<stdint.h>`, `<stdbool.h>`, etc. will use built-in type definitions rather than reparsing them each time. Benefits:

- Faster compilation (no parsing overhead)
- Consistent behavior across platforms
- Known type widths (e.g., `uint32_t` = 32 bits)

The existing `C_TYPE_WIDTH` map already provides this for basic types. We'll expand it as needed.

### 2. Caching: `.cnx` Directory

The dependency tree and parsed symbols will be cached in a `.cnx/` directory (similar to `.git/`):

```
project/
├── .cnx/
│   ├── cache/
│   │   ├── symbols.json      # Cached SymbolTable
│   │   └── deps.json         # Cached dependency tree
│   └── config.json           # Cache metadata (timestamps, versions)
├── src/
│   └── main.cnx
└── include/
    └── AppConfig.h
```

Cache invalidation: Compare file modification timestamps. If any file in the dependency tree has changed, rebuild that subtree.

### 3. Circular Includes: Absolute Path Keys

Use absolute (fully resolved) file paths as keys to track visited files:

```typescript
const visited = new Set<string>(); // Absolute paths

function processInclude(relativePath: string, currentDir: string): void {
  const absolutePath = resolve(currentDir, relativePath);

  if (visited.has(absolutePath)) {
    return; // Already processed, skip
  }

  visited.add(absolutePath);
  // Process file...
}
```

This handles:

- Circular includes (A includes B, B includes A)
- Same file included from different paths
- Include guards become redundant (but still respected)

## Decision

**Accepted.** Implement a unified multi-pass transpiler pipeline with the following architecture:

1. **Source Discovery** - Detect input type (file vs directory), discover all `.cnx` files
2. **Preprocessor** - Build dependency tree from `#include` directives
3. **Symbol Collector** - Parse C/C++ headers for type information (read-only)
4. **Transpiler** - Generate `.c` code from `.cnx` files using SymbolTable
5. **Output** - Write generated `.c` files

Key decisions:

- Multi-pass + state-file caching (like TypeScript)
- System headers use built-in knowledge
- Cache stored in `.cnx/` directory with timestamp invalidation
- Absolute paths as keys to prevent duplicates/cycles
- Unified pipeline for both single-file and directory inputs
