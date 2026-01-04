# C-Next v1 Feature Matrix

Based on "Learn X in Y Minutes" analysis for C, Rust, Go, and Zig.

**Goal:** Define what C-Next needs to be a complete C replacement for embedded systems.

## Section-by-Section Analysis

### Legend

- **Status:** `✅ Implemented` | `🔧 Partial` | `❌ Missing` | `🚫 Not Needed` | `❓ Needs Decision`
- **ADR:** Existing ADR reference or "NEW" if decision needed

---

## 1. Comments

| Feature            | C-Next Status  | ADR | Notes                                  |
| ------------------ | -------------- | --- | -------------------------------------- |
| Single-line `//`   | ✅ Implemented | —   | Grammar: `LINE_COMMENT`                |
| Multi-line `/* */` | ✅ Implemented | —   | Grammar: `BLOCK_COMMENT`               |
| Doc comments `///` | 🔧 Partial     | —   | Parsed to HIDDEN channel, not used yet |

**Decision Needed:** Should `///` generate documentation in output? Or just pass through?

---

## 2. Preprocessor / Includes

| Feature               | C-Next Status     | ADR | Notes                  |
| --------------------- | ----------------- | --- | ---------------------- |
| `#include <header.h>` | ✅ Implemented    | —   | Pass-through to C      |
| `#include "header.h"` | ✅ Implemented    | —   | Pass-through to C      |
| `#define` macros      | ❓ Needs Decision | NEW | Pass-through or parse? |
| `#ifdef` / `#ifndef`  | ❓ Needs Decision | NEW | Pass-through or parse? |
| Include guards        | ✅ Implemented    | —   | Generated in headers   |

**Decision Needed:** ADR-017 - Preprocessor Directive Handling

- Option A: Pure pass-through (current for `#include`)
- Option B: Parse all, validate, pass-through
- Option C: Selective parsing (defines for constants, pass-through for conditional)

---

## 3. Types

| Feature              | C-Next Status     | ADR     | Notes                                                |
| -------------------- | ----------------- | ------- | ---------------------------------------------------- |
| Fixed-width integers | ✅ Implemented    | —       | `u8`, `u16`, `u32`, `u64`, `i8`, `i16`, `i32`, `i64` |
| Floating point       | ✅ Implemented    | —       | `f32`, `f64`                                         |
| Boolean              | ✅ Implemented    | —       | `bool`, `true`, `false`                              |
| Character            | ✅ Implemented    | —       | `CHAR_LITERAL` in grammar                            |
| Void                 | ✅ Implemented    | —       | For function returns                                 |
| Size type            | ❓ Needs Decision | NEW     | `size` or `usize` for array lengths?                 |
| Pointer type         | 🚫 Not Needed     | ADR-006 | References are implicit                              |
| User-defined types   | ✅ Implemented    | ADR-014 | `struct`                                             |
| Type aliases         | ❓ Needs Decision | NEW     | `type Byte <- u8;` syntax?                           |
| Enums                | ❌ Missing        | NEW     | C-style or Rust-style?                               |

**Decision Needed:**

- ADR-018 - Enums (critical for embedded - register values, states, errors)
- ADR-019 - Type aliases (nice to have for readability)
- ADR-020 - Size type for array indexing

---

## 4. Variables & Constants

| Feature              | C-Next Status     | ADR     | Notes                          |
| -------------------- | ----------------- | ------- | ------------------------------ |
| Variable declaration | ✅ Implemented    | —       | `u32 x;`                       |
| Initialization       | ✅ Implemented    | ADR-015 | Zero-init by default           |
| Assignment operator  | ✅ Implemented    | ADR-001 | `<-` not `=`                   |
| Constants            | ✅ Implemented    | ADR-013 | `const u32 X <- 5;`            |
| Static variables     | ❓ Needs Decision | NEW     | File-scope vs function-static  |
| Volatile             | 🔧 Partial        | —       | In grammar but codegen unclear |
| Extern               | ❌ Missing        | NEW     | Cross-file declarations        |

**Decision Needed:**

- ADR-021 - Static and extern (needed for multi-file projects)
- Verify volatile codegen works correctly

---

## 5. Arrays

| Feature                | C-Next Status     | ADR     | Notes                       |
| ---------------------- | ----------------- | ------- | --------------------------- |
| Fixed-size arrays      | ✅ Implemented    | —       | `u8 buffer[16];`            |
| Array initialization   | ❓ Needs Decision | NEW     | `u8 data[] <- {1, 2, 3};` ? |
| Multi-dimensional      | ❌ Missing        | NEW     | `u8 matrix[4][4];`          |
| `.length` property     | ✅ Implemented    | ADR-007 | Compile-time array length   |
| Variable-length arrays | 🚫 Not Needed     | ADR-003 | Static allocation only      |
| Dynamic arrays         | 🚫 Not Needed     | ADR-003 | No runtime allocation       |
| Slices                 | ❓ Needs Decision | NEW     | `buffer[0..5]` syntax?      |

**Decision Needed:**

- ADR-022 - Array initialization syntax
- ADR-023 - Multi-dimensional arrays
- Consider slices for v2 (not v1 critical)

---

## 6. Operators

| Feature                     | C-Next Status     | ADR     | Notes                            |
| --------------------------- | ----------------- | ------- | -------------------------------- |
| Arithmetic `+ - * / %`      | ✅ Implemented    | —       | —                                |
| Comparison `= != < > <= >=` | ✅ Implemented    | ADR-001 | `=` for equality                 |
| Logical `&& \|\| !`         | ✅ Implemented    | —       | —                                |
| Bitwise `& \| ^ ~ << >>`    | ✅ Implemented    | —       | —                                |
| Compound assignment         | ✅ Implemented    | ADR-001 | `+<-`, `-<-`, etc.               |
| Increment/decrement `++ --` | ❌ Missing        | NEW     | Add or reject?                   |
| Ternary `? :`               | ❌ Missing        | NEW     | Add or reject?                   |
| Sizeof                      | ❓ Needs Decision | NEW     | `sizeof(T)` or `.size` property? |
| Address-of `&`              | ✅ Implemented    | ADR-006 | Read-only address                |

**Decision Needed:**

- ADR-024 - Increment/decrement operators (common in C, but prone to bugs)
- ADR-025 - Ternary operator (useful but sometimes unclear)
- ADR-026 - Sizeof mechanism

---

## 7. Control Flow

| Feature         | C-Next Status     | ADR | Notes                  |
| --------------- | ----------------- | --- | ---------------------- |
| `if / else`     | ✅ Implemented    | —   | —                      |
| `while`         | ✅ Implemented    | —   | —                      |
| `for`           | ✅ Implemented    | —   | C-style `for(;;)`      |
| `do-while`      | ❌ Missing        | NEW | Add?                   |
| `switch`        | ❌ Missing        | NEW | Critical for embedded  |
| `break`         | ❌ Missing        | NEW | Loop control           |
| `continue`      | ❌ Missing        | NEW | Loop control           |
| `goto`          | ❓ Needs Decision | NEW | Allow or reject?       |
| Range-based for | ❓ Needs Decision | NEW | `for x in array { }` ? |

**Decision Needed:**

- ADR-027 - Switch statements (CRITICAL - used constantly in embedded)
- ADR-028 - Break/continue (needed for switch and loops)
- ADR-029 - Do-while (occasionally useful)
- ADR-030 - Goto (controversial but sometimes needed for cleanup)

---

## 8. Functions

| Feature              | C-Next Status     | ADR     | Notes                           |
| -------------------- | ----------------- | ------- | ------------------------------- |
| Declaration          | ✅ Implemented    | —       | `void foo() { }`                |
| Parameters           | ✅ Implemented    | —       | `void foo(u32 x)`               |
| Return values        | ✅ Implemented    | —       | `u32 foo()`                     |
| Pass by value        | ✅ Implemented    | —       | Default for primitives          |
| Pass by reference    | ✅ Implemented    | ADR-006 | Implicit for structs            |
| Multiple returns     | ❌ Missing        | NEW     | Tuples? Out params?             |
| Function pointers    | ❌ Missing        | NEW     | Callbacks critical for embedded |
| Variadic functions   | ❓ Needs Decision | NEW     | `printf`-style?                 |
| Static functions     | ❓ Needs Decision | NEW     | File-local functions            |
| Inline               | ❓ Needs Decision | NEW     | `inline` keyword?               |
| Forward declarations | ❌ Missing        | NEW     | Needed for mutual recursion     |

**Decision Needed:**

- ADR-031 - Function pointers (CRITICAL - callbacks, ISRs, etc.)
- ADR-032 - Forward declarations / prototypes
- ADR-033 - Inline functions

---

## 9. Structs

| Feature           | C-Next Status     | ADR     | Notes                            |
| ----------------- | ----------------- | ------- | -------------------------------- |
| Declaration       | ✅ Implemented    | ADR-014 | `struct Point { i32 x; i32 y; }` |
| Member access     | ✅ Implemented    | —       | `point.x`                        |
| Initialization    | ✅ Implemented    | ADR-014 | `Point { x: 10, y: 20 }`         |
| Zero-init         | ✅ Implemented    | ADR-015 | Automatic                        |
| Array members     | ✅ Implemented    | —       | `u8 data[16];` in struct         |
| Nested structs    | ❓ Needs Decision | NEW     | `struct A { B inner; }`          |
| Anonymous structs | 🚫 Not Needed     | —       | Complexity not worth it          |
| Bit fields        | ❓ Needs Decision | NEW     | C-style `: 3` bit fields?        |
| Packed structs    | ❓ Needs Decision | NEW     | `#pragma pack` or attribute?     |

**Decision Needed:**

- ADR-034 - Nested structs (common pattern)
- ADR-035 - Packed/aligned structs (critical for hardware)
- ADR-036 - C-style bit fields (vs register bitfields)

---

## 10. Unions

| Feature           | C-Next Status     | ADR | Notes                 |
| ----------------- | ----------------- | --- | --------------------- |
| Union declaration | ❌ Missing        | NEW | Critical for embedded |
| Tagged unions     | ❓ Needs Decision | NEW | Rust-style enums?     |

**Decision Needed:**

- ADR-037 - Unions (CRITICAL - register overlays, protocol parsing)

---

## 11. Memory & Pointers

| Feature            | C-Next Status     | ADR     | Notes               |
| ------------------ | ----------------- | ------- | ------------------- |
| Pointer syntax     | 🚫 Not Needed     | ADR-006 | Implicit references |
| Address-of         | ✅ Implemented    | ADR-006 | `&x` read-only      |
| Dereferencing      | 🚫 Not Needed     | ADR-006 | Implicit            |
| Dynamic allocation | 🚫 Not Needed     | ADR-003 | Static only         |
| malloc/free        | 🚫 Not Needed     | ADR-003 | Forbidden           |
| Null               | ✅ Implemented    | —       | `null` keyword      |
| Null safety        | ❓ Needs Decision | NEW     | Optional types?     |

**Decision Needed:**

- ADR-038 - Null safety (Rust Option-like? or just warnings?)

---

## 12. Hardware / Embedded Specific

| Feature           | C-Next Status     | ADR     | Notes                          |
| ----------------- | ----------------- | ------- | ------------------------------ |
| Register bindings | ✅ Implemented    | ADR-004 | Type-safe hardware access      |
| Access modifiers  | ✅ Implemented    | ADR-004 | `ro`, `rw`, `wo`, `w1c`, `w1s` |
| Bit indexing      | ✅ Implemented    | ADR-007 | `reg[bit] <- true`             |
| Bit ranges        | ✅ Implemented    | ADR-007 | `reg[start, width]`            |
| ISR declaration   | ❌ Missing        | ADR-009 | Research phase                 |
| Volatile access   | 🔧 Partial        | —       | In grammar, verify codegen     |
| Memory barriers   | ❌ Missing        | NEW     | `barrier()` or intrinsic?      |
| Inline assembly   | ❓ Needs Decision | NEW     | `asm { }` block?               |

**Decision Needed:**

- ADR-039 - ISR declaration syntax (ADR-009 is research)
- ADR-040 - Inline assembly (sometimes unavoidable)

---

## 13. Type Casting

| Feature           | C-Next Status     | ADR | Notes                    |
| ----------------- | ----------------- | --- | ------------------------ |
| Implicit widening | ❓ Needs Decision | NEW | `u8` to `u32` automatic? |
| Explicit casting  | ❌ Missing        | NEW | `x as u32` or `(u32)x`?  |
| Truncation        | ❓ Needs Decision | NEW | Error or warning?        |

**Decision Needed:**

- ADR-041 - Type casting syntax and rules (CRITICAL)

---

## 14. Error Handling

| Feature      | C-Next Status     | ADR | Notes                 |
| ------------ | ----------------- | --- | --------------------- |
| Return codes | ✅ Implemented    | —   | C-style return values |
| Error type   | ❓ Needs Decision | NEW | Result<T, E>? Errno?  |
| Panic/assert | ❓ Needs Decision | NEW | `assert(condition)`   |

**Decision Needed:**

- ADR-042 - Error handling strategy (defer to v2?)

---

## 15. Organization

| Feature              | C-Next Status  | ADR     | Notes                       |
| -------------------- | -------------- | ------- | --------------------------- |
| Scope                | ✅ Implemented | ADR-016 | Name prefixing              |
| Visibility           | ✅ Implemented | ADR-016 | `public` / `private`        |
| Multi-file           | 🔧 Partial     | —       | CLI supports, needs headers |
| Header generation    | ✅ Implemented | —       | Automatic `.h` files        |
| Forward declarations | ❌ Missing     | NEW     | Cross-file references       |

---

## Priority Summary for v1

### CRITICAL (Must Have for v1)

1. **Enums** (ADR-018) - Constants, states, error codes
2. **Switch statements** (ADR-027) - Used everywhere in embedded
3. **Break/continue** (ADR-028) - Loop and switch control
4. **Function pointers** (ADR-031) - Callbacks, ISRs, vtables
5. **Unions** (ADR-037) - Register overlays, protocol parsing
6. **Type casting** (ADR-041) - Unavoidable in embedded
7. **Forward declarations** (ADR-032) - Multi-file projects

### HIGH (Should Have for v1)

8. **Preprocessor directives** (ADR-017) - `#define`, `#ifdef`
9. **Static/extern** (ADR-021) - Multi-file variables
10. **Ternary operator** (ADR-025) - Common idiom
11. **Sizeof** (ADR-026) - Buffer sizing
12. **Packed structs** (ADR-035) - Hardware alignment
13. **Nested structs** (ADR-034) - Common pattern

### MEDIUM (Nice to Have for v1)

14. **Increment/decrement** (ADR-024) - Convenience
15. **Do-while** (ADR-029) - Occasionally useful
16. **Array initializers** (ADR-022) - Lookup tables
17. **Multi-dimensional arrays** (ADR-023) - Matrices
18. **Inline functions** (ADR-033) - Performance

### LOW (Consider for v2)

19. Type aliases (ADR-019)
20. Size type (ADR-020)
21. Range-based for
22. Slices
23. Null safety (ADR-038)
24. Error handling (ADR-042)
25. Inline assembly (ADR-040)
26. Goto (ADR-030)

---

## Next Steps

1. Create ADRs for CRITICAL items
2. Implement grammar changes
3. Update CodeGenerator
4. Add examples for each feature
5. Write Learn C-Next in Y Minutes as implementation progresses
