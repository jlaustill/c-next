# ADR-010: C/C++ Interoperability via Unified ANTLR Parsing

**Status:** Partial (In Progress)
**Date:** 2025-12-27
**Last Updated:** 2026-01-13
**Decision Makers:** C-Next Language Design Team
**Tracking:** [Issue #39](https://github.com/jlaustill/c-next/issues/39)

## Context

For C-Next to succeed in real embedded projects, it must support **incremental adoption**. Teams cannot rewrite entire codebases at once. They need to:

1. Add C-Next files to existing C/C++ projects
2. Call C/C++ code from C-Next
3. Call C-Next code from C/C++
4. Convert file-by-file over time

### The Key Insight

ANTLR already has battle-tested grammars for C and C++ in the [grammars-v4](https://github.com/antlr/grammars-v4) repository. Instead of inventing new declaration formats or special syntax, we simply use the right parser for each file type.

---

## Decision: Unified ANTLR Parser Architecture

Parse all source files with their native ANTLR grammar, building a unified symbol table:

```
┌─────────────┐     ┌─────────────────┐
│  .cnx files │────▶│  CNext Grammar  │────┐
└─────────────┘     └─────────────────┘    │
                                           │
┌─────────────┐     ┌─────────────────┐    │     ┌─────────────┐
│  .c/.h files│────▶│   C Grammar     │────┼────▶│   Unified   │────▶ .c + .h
└─────────────┘     └─────────────────┘    │     │   Symbol    │
                                           │     │   Table     │
┌─────────────┐     ┌─────────────────┐    │     └─────────────┘
│ .cpp/.hpp   │────▶│  C++ Grammar    │────┘
└─────────────┘     └─────────────────┘
```

**No declaration files. No extern blocks. No special syntax.**

---

## Advantages

### 1. Battle-Tested Patterns Force Good Design

Using existing C/C++ grammars means C-Next naturally aligns with established patterns:

- **Expression precedence** matches C exactly
- **Type declaration patterns** are compatible
- **Statement structures** align with C conventions
- **Operator semantics** follow C standards

This isn't just about parsing C files — it's about ensuring C-Next's own grammar follows patterns that decades of C development have proven work.

### 2. No New Syntax Required

C-Next code simply uses symbols that exist in the unified symbol table:

```cnx
// Arduino functions are parsed from Arduino.h
// No extern declarations needed - they're in the symbol table
void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    delay(1000);
}
```

### 3. True Incremental Adoption

- Add .cnx files to existing C/C++ projects
- Existing .c/.h files work unchanged
- No wrapper files or declaration stubs
- Convert file-by-file at your own pace

### 4. Leverage the ANTLR Ecosystem

- [grammars-v4](https://github.com/antlr/grammars-v4) — 200+ maintained grammars
- [symtab](https://github.com/antlr/symtab) — Generic symbol table library
- Community-maintained, continuously improved
- Same toolchain for all languages

### 5. Single Toolchain

One parser infrastructure handles everything:

- No separate header parser
- No declaration file generator
- No special build steps for interop

---

## C-Next File Includes

C-Next supports including other C-Next files using standard C `#include` syntax. The transpiler automatically transforms `.cnx` file references to `.h` references in the generated C code:

```cnx
// C-Next source file
#include <types.cnx>        // System/library includes use angle brackets
#include "utils.cnx"        // Local includes use quotes

u32 main() {
    Point p;
    p.x <- calculate(10);
    return 0;
}
```

Transpiles to:

```c
// Generated C file
#include <types.h>          // .cnx → .h transformation
#include "utils.h"          // Works with both <> and ""

uint32_t main(void) {
    Point p = {0};
    p.x = calculate(10);
    return 0;
}
```

**Key features:**

- Supports both `<file.cnx>` and `"file.cnx"` syntax
- Validates that quoted (local) `.cnx` files exist at transpile time
- Angle bracket includes (system/library) are transformed without validation
- Works with relative paths: `"../../common/types.cnx"` → `"../../common/types.h"`

This enables modular C-Next code while ensuring the generated C code includes the correct header files.

---

## Known Limitations

### C Grammar

- Mature and well-tested (C11 specification)
- Preprocessor must run before parsing
- May need minor customization for edge cases

### C++ Grammar (CPP14)

- Does not parse nested templates: `vector<unique_ptr<T>>`
- Only covers C++14, not C++17/20 features
- GCC extensions not supported
- Suitable for most embedded C++ code

### Preprocessor Handling

C headers use heavy preprocessing. Options:

1. **Run cpp first** — Preprocess with system cpp, parse result
2. **Parse post-include** — Parse the already-preprocessed translation unit
3. **Common-case handling** — Handle simple `#define`, ignore complex macros

For embedded projects (Arduino, Teensy), option 1 or 2 works well since the build system already preprocesses.

---

## Implementation Phases

### Phase 1: Add C Grammar

1. Import `C.g4` from grammars-v4
2. Configure antlr4ng to generate TypeScript parser
3. Create `CSymbolCollector` visitor to extract:
   - Function declarations/definitions
   - Type definitions (typedef, struct, enum)
   - Global variables
   - Macro constants (from preprocessed output)

### Phase 2: Unified Symbol Table

1. Design shared `SymbolTable` interface
2. Both CNext and C parsers populate it
3. CodeGenerator resolves symbols from unified table
4. Track symbol origin (which file, which language)

### Phase 3: Cross-File Resolution

1. Parse all project files (any order)
2. Build complete symbol table
3. Resolve references across file boundaries
4. Report undefined symbols as errors

### Phase 4: Header Generation

1. Emit `.h` files alongside `.c` files
2. Public C-Next symbols become C declarations
3. Enable C code to call C-Next functions

### Phase 5: C++ Support (Optional)

1. Import CPP14 grammar
2. Handle C++ specific symbols (classes, namespaces)
3. Work around nested template limitation
4. Consider C++17 grammar when available

---

## Implementation Status

**Completed:**

- ✅ Phase 1: C11 and CPP14 grammars imported from grammars-v4
- ✅ Phase 1: `CSymbolCollector` and `CppSymbolCollector` extract symbols from C/C++ files
- ✅ Phase 2: `SymbolTable` class with cross-language conflict detection
- ✅ Phase 2: All parsers (CNext, C, C++) populate unified symbol table
- ✅ Phase 3: Cross-file resolution with SymbolTable integration
  - **Implementation:** `CodeGenerator` now queries `SymbolTable` for struct field types
  - **Fix:** Enhanced `SymbolTable` to store struct field information (type + array dimensions)
  - **Fix:** Updated `CSymbolCollector` to extract struct field types from C headers
  - **Fix:** Updated `CodeGenerator` to use unified lookup checking both local structs and SymbolTable
  - **Impact:** `.length` property now works correctly on C header struct members ([Issue #45](https://github.com/jlaustill/c-next/issues/45))
- ✅ Phase 4: `HeaderGenerator` emits `.h` files with include guards
- ✅ Phase 5: C++ grammar imported and working (with known limitations)
- ✅ `Preprocessor` with toolchain detection (gcc/clang/arm-gcc)
- ✅ `Project` class for multi-file compilation
- ✅ CLI `--project` mode for multi-file builds

**Not Started:**

- ❌ Remove `--project` flag (should always use unified parsing)
- ❌ Make unified parsing the default behavior

**Known Issues:**

- Single-file mode (`cnext file.cnx`) doesn't parse C headers
- Array indexing on C header structs broken (related to [Issue #8](https://github.com/jlaustill/c-next/issues/8))

---

## Example: Mixed Project

```
project/
├── main.cnx          # C-Next entry point
├── drivers/
│   ├── gpio.c        # Existing C driver
│   └── gpio.h        # C header
├── sensors/
│   └── temp.cnx      # New C-Next module
└── lib/
    └── Arduino.h     # External library
```

Build process:

1. Preprocess all .h files
2. Parse .cnx with CNext grammar → symbol table
3. Parse .c/.h with C grammar → symbol table
4. Resolve all cross-references
5. Generate .c + .h for each .cnx file
6. Compile with standard C toolchain

---

## Comparison: Old vs New Approach

| Aspect         | Old (Overcomplicated)       | New (Unified ANTLR)    |
| -------------- | --------------------------- | ---------------------- |
| C declarations | `extern` blocks or .d files | Parsed directly        |
| C headers      | Custom parser or ignore     | ANTLR C grammar        |
| New syntax     | `extern "C" { ... }`        | None needed            |
| Toolchain      | Multiple parsers            | One ANTLR setup        |
| Maintenance    | Declaration files drift     | Single source of truth |
| Adoption       | Requires wrappers           | Drop-in compatible     |

---

## Open Questions

### Resolved

1. **Preprocessor strategy** ✅
   - **Decision:** Run system cpp and parse output
   - **Rationale:** `Preprocessor` class uses gcc/clang/arm-gcc to preprocess C headers before parsing
   - **Implementation:** Already working in project mode

2. **Symbol conflicts** ✅
   - **Decision:** Symbol conflicts between C-Next and C/C++ are **ERRORS**
   - **Exceptions:**
     - Multiple `extern` declarations in C (OK - declaration, not definition)
     - C++ function overloads (OK - different signatures)
   - **Rationale:** Catch collisions for safety, don't silently shadow
   - **Implementation:** `SymbolTable` already implements this behavior

3. **Build system integration** ✅
   - **Decision:** Remove `--project` flag, always use unified parsing
   - **Behavior:**
     - `cnext file.cnx` → Parses file.cnx + discovers and parses headers referenced by `#include` directives
     - `cnext src/*.cnx` → Multi-file mode (parses all .cnx files + their included headers)
     - Always builds unified symbol table
   - **Include Path Resolution:**
     - Parse .cnx files first, extract `#include "..."` and `#include <...>` directives
     - Resolve header paths using `--include` directories (if specified) and standard search rules
     - Parse ONLY headers that are actually `#include`d (not all .h files in include dirs)
     - **Parsed header extensions:** `.h`, `.hpp`, `.hh`, `.hxx`, `.h++`, `.inl`, `.cnx`
     - **Error on implementation files:** `.c`, `.cpp`, `.cc`, `.cxx`, `.c++` (not headers, should not be #included)
     - **Benefit:** Matches standard C behavior and improves IntelliSense (only shows symbols in scope)
   - **Rationale:** Unified parsing should be the default behavior as shown in architecture diagram
   - **Watch mode:** Deferred - VSCode extension already handles live rebuilds gracefully
   - **Implementation:** TODO - requires refactoring CLI to remove mode distinction and implement smart include discovery

4. **C++ priority** ✅
   - **Decision:** Context-dependent priority - fix issues in whichever language users encounter them
   - **Rationale:**
     - Both C and C++ infrastructure already implemented using upstream ANTLR grammars
     - Many embedded projects mix C and C++ (Arduino, mbed, Zephyr)
     - Fixes may result in PRs back to grammars-v4 upstream projects
     - User needs drive priority, not arbitrary language preference
   - **Implementation:** Both C and C++ are first-class citizens

---

## References

### ANTLR Resources

- [grammars-v4 Repository](https://github.com/antlr/grammars-v4)
- [C Grammar (C11)](https://github.com/antlr/grammars-v4/tree/master/c)
- [CPP14 Grammar](https://github.com/antlr/grammars-v4/tree/master/cpp)
- [ANTLR Symbol Table Library](https://github.com/antlr/symtab)

### Best Practices

- [ANTLR Mega Tutorial](https://tomassetti.me/antlr-mega-tutorial/)
- [Multi-Language Parsing Patterns](https://tomassetti.me/best-practices-for-antlr-parsers/)
- [Symbol Table Management](https://martinlwx.github.io/en/how-to-use-antlr4-to-make-semantic-actions/)
