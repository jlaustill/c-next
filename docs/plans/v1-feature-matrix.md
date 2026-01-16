# C-Next v1 Feature Matrix

Based on "Learn X in Y Minutes" analysis for C, Rust, Go, and Zig.

**Goal:** Define what C-Next needs to be a complete C replacement for embedded systems.

**Last Updated:** 2026-01-16

## Section-by-Section Analysis

### Legend

- **Status:** `✅ Implemented` | `🔧 Partial` | `🚫 Rejected` | `🚫 Not Needed` | `❓ Needs Decision`
- **ADR:** Existing ADR reference

---

## 1. Comments

| Feature            | C-Next Status  | ADR | Notes                                  |
| ------------------ | -------------- | --- | -------------------------------------- |
| Single-line `//`   | ✅ Implemented | —   | Grammar: `LINE_COMMENT`                |
| Multi-line `/* */` | ✅ Implemented | —   | Grammar: `BLOCK_COMMENT`               |
| Doc comments `///` | 🔧 Partial     | —   | Parsed to HIDDEN channel, not used yet |

---

## 2. Preprocessor / Includes

| Feature               | C-Next Status  | ADR     | Notes                                            |
| --------------------- | -------------- | ------- | ------------------------------------------------ |
| `#include <header.h>` | ✅ Implemented | —       | Pass-through to C                                |
| `#include "header.h"` | ✅ Implemented | —       | Pass-through to C                                |
| `#define` flag macros | ✅ Implemented | ADR-037 | Flag-only defines pass through                   |
| `#define` value/fn    | 🚫 Rejected    | ADR-037 | Value defines and function macros produce errors |
| `#ifdef` / `#ifndef`  | ✅ Implemented | ADR-037 | Pass-through to C                                |
| Include guards        | ✅ Implemented | —       | Generated in headers                             |

---

## 3. Types

| Feature              | C-Next Status  | ADR     | Notes                                                |
| -------------------- | -------------- | ------- | ---------------------------------------------------- |
| Fixed-width integers | ✅ Implemented | —       | `u8`, `u16`, `u32`, `u64`, `i8`, `i16`, `i32`, `i64` |
| Floating point       | ✅ Implemented | —       | `f32`, `f64`                                         |
| Boolean              | ✅ Implemented | —       | `bool`, `true`, `false`                              |
| Character            | ✅ Implemented | —       | `CHAR_LITERAL` in grammar                            |
| Void                 | ✅ Implemented | —       | For function returns                                 |
| Pointer type         | 🚫 Not Needed  | ADR-006 | References are implicit                              |
| User-defined types   | ✅ Implemented | ADR-014 | `struct`                                             |
| Enums                | ✅ Implemented | ADR-017 | Type-safe enums with explicit values                 |

---

## 4. Variables & Constants

| Feature              | C-Next Status  | ADR     | Notes                                    |
| -------------------- | -------------- | ------- | ---------------------------------------- |
| Variable declaration | ✅ Implemented | —       | `u32 x;`                                 |
| Initialization       | ✅ Implemented | ADR-015 | Zero-init by default                     |
| Assignment operator  | ✅ Implemented | ADR-001 | `<-` not `=`                             |
| Constants            | ✅ Implemented | ADR-013 | `const u32 X <- 5;`                      |
| Volatile             | ✅ Implemented | ADR-108 | `volatile` keyword prevents optimization |

---

## 5. Arrays

| Feature                | C-Next Status  | ADR     | Notes                     |
| ---------------------- | -------------- | ------- | ------------------------- |
| Fixed-size arrays      | ✅ Implemented | —       | `u8 buffer[16];`          |
| Array initialization   | ✅ Implemented | ADR-035 | `u8 data[] <- {1, 2, 3};` |
| Multi-dimensional      | ✅ Implemented | ADR-036 | `u8 matrix[4][4];`        |
| `.length` property     | ✅ Implemented | ADR-007 | Compile-time array length |
| Variable-length arrays | 🚫 Not Needed  | ADR-003 | Static allocation only    |
| Dynamic arrays         | 🚫 Not Needed  | ADR-003 | No runtime allocation     |

---

## 6. Operators

| Feature                     | C-Next Status  | ADR     | Notes                            |
| --------------------------- | -------------- | ------- | -------------------------------- |
| Arithmetic `+ - * / %`      | ✅ Implemented | —       | —                                |
| Comparison `= != < > <= >=` | ✅ Implemented | ADR-001 | `=` for equality                 |
| Logical `&& \|\| !`         | ✅ Implemented | —       | —                                |
| Bitwise `& \| ^ ~ << >>`    | ✅ Implemented | —       | —                                |
| Compound assignment         | ✅ Implemented | ADR-001 | `+<-`, `-<-`, etc.               |
| Increment/decrement `++ --` | 🚫 Rejected    | ADR-021 | Compound assignment is clearer   |
| Ternary `? :`               | ✅ Implemented | ADR-022 | Required parentheses for clarity |
| Sizeof                      | ✅ Implemented | ADR-023 | `sizeof(T)` and `.size` property |
| Address-of `&`              | ✅ Implemented | ADR-006 | Read-only address                |

---

## 7. Control Flow

| Feature     | C-Next Status  | ADR     | Notes                               |
| ----------- | -------------- | ------- | ----------------------------------- |
| `if / else` | ✅ Implemented | —       | —                                   |
| `while`     | ✅ Implemented | —       | —                                   |
| `for`       | ✅ Implemented | —       | C-style `for(;;)`                   |
| `do-while`  | ✅ Implemented | ADR-027 | —                                   |
| `switch`    | ✅ Implemented | ADR-025 | Implicit break, no fallthrough      |
| `break`     | 🚫 Rejected    | ADR-026 | Use exit conditions in loop headers |
| `continue`  | 🚫 Rejected    | ADR-026 | Use guard conditions instead        |
| `goto`      | 🚫 Rejected    | ADR-028 | Use structured programming patterns |

---

## 8. Functions

| Feature              | C-Next Status  | ADR     | Notes                       |
| -------------------- | -------------- | ------- | --------------------------- |
| Declaration          | ✅ Implemented | —       | `void foo() { }`            |
| Parameters           | ✅ Implemented | —       | `void foo(u32 x)`           |
| Return values        | ✅ Implemented | —       | `u32 foo()`                 |
| Pass by value        | ✅ Implemented | —       | Default for primitives      |
| Pass by reference    | ✅ Implemented | ADR-006 | Implicit for structs        |
| Callbacks            | ✅ Implemented | ADR-029 | Function-as-type pattern    |
| Forward declarations | ✅ Implemented | ADR-030 | Needed for mutual recursion |

---

## 9. Structs

| Feature           | C-Next Status  | ADR     | Notes                            |
| ----------------- | -------------- | ------- | -------------------------------- |
| Declaration       | ✅ Implemented | ADR-014 | `struct Point { i32 x; i32 y; }` |
| Member access     | ✅ Implemented | —       | `point.x`                        |
| Initialization    | ✅ Implemented | ADR-014 | `Point { x: 10, y: 20 }`         |
| Zero-init         | ✅ Implemented | ADR-015 | Automatic                        |
| Array members     | ✅ Implemented | —       | `u8 data[16];` in struct         |
| Nested structs    | ✅ Implemented | ADR-032 | `struct A { B inner; }`          |
| Anonymous structs | 🚫 Not Needed  | —       | Complexity not worth it          |

---

## 10. Unions

| Feature           | C-Next Status | ADR     | Notes                                      |
| ----------------- | ------------- | ------- | ------------------------------------------ |
| Union declaration | 🚫 Rejected   | ADR-018 | Use register bindings or byte manipulation |
| Tagged unions     | 🚫 Rejected   | ADR-018 | Use enums + structs instead                |

---

## 11. Memory & Pointers

| Feature            | C-Next Status  | ADR     | Notes               |
| ------------------ | -------------- | ------- | ------------------- |
| Pointer syntax     | 🚫 Not Needed  | ADR-006 | Implicit references |
| Address-of         | ✅ Implemented | ADR-006 | `&x` read-only      |
| Dereferencing      | 🚫 Not Needed  | ADR-006 | Implicit            |
| Dynamic allocation | 🚫 Not Needed  | ADR-003 | Static only         |
| malloc/free        | 🚫 Not Needed  | ADR-003 | Forbidden           |
| NULL keyword       | ✅ Implemented | ADR-047 | C library interop   |

---

## 12. Hardware / Embedded Specific

| Feature           | C-Next Status  | ADR     | Notes                          |
| ----------------- | -------------- | ------- | ------------------------------ |
| Register bindings | ✅ Implemented | ADR-004 | Type-safe hardware access      |
| Access modifiers  | ✅ Implemented | ADR-004 | `ro`, `rw`, `wo`, `w1c`, `w1s` |
| Bit indexing      | ✅ Implemented | ADR-007 | `reg[bit] <- true`             |
| Bit ranges        | ✅ Implemented | ADR-007 | `reg[start, width]`            |
| ISR declaration   | 🔧 Partial     | ADR-009 | Research phase                 |
| Volatile access   | ✅ Implemented | ADR-108 | `volatile` keyword             |
| Critical sections | ✅ Implemented | ADR-050 | `critical { }` blocks          |
| Atomic types      | ✅ Implemented | ADR-049 | `atomic` keyword               |

---

## 13. Type Casting

| Feature          | C-Next Status  | ADR     | Notes             |
| ---------------- | -------------- | ------- | ----------------- |
| Explicit casting | ✅ Implemented | ADR-024 | `x as u32` syntax |

---

## 14. Error Handling

| Feature      | C-Next Status  | ADR | Notes                 |
| ------------ | -------------- | --- | --------------------- |
| Return codes | ✅ Implemented | —   | C-style return values |

---

## 15. Organization

| Feature              | C-Next Status  | ADR     | Notes                 |
| -------------------- | -------------- | ------- | --------------------- |
| Scope                | ✅ Implemented | ADR-016 | Name prefixing        |
| Visibility           | ✅ Implemented | ADR-016 | `public` / `private`  |
| Multi-file           | ✅ Implemented | ADR-010 | Unified ANTLR parsing |
| Header generation    | ✅ Implemented | —       | Automatic `.h` files  |
| Forward declarations | ✅ Implemented | ADR-030 | Cross-file references |

---

## Summary

### v1 Complete

The following critical features are implemented:

1. **Enums** (ADR-017) ✅
2. **Switch statements** (ADR-025) ✅
3. **Callbacks/Function pointers** (ADR-029) ✅
4. **Type casting** (ADR-024) ✅
5. **Forward declarations** (ADR-030) ✅
6. **Preprocessor handling** (ADR-037) ✅
7. **Ternary operator** (ADR-022) ✅
8. **Sizeof** (ADR-023) ✅
9. **Nested structs** (ADR-032) ✅
10. **Do-while** (ADR-027) ✅
11. **Array initializers** (ADR-035) ✅
12. **Multi-dimensional arrays** (ADR-036) ✅

### Rejected by Design

These features are intentionally not part of C-Next:

1. **Break/continue** (ADR-026) — Use exit conditions in loop headers
2. **Unions** (ADR-018) — Use register bindings or explicit byte manipulation
3. **Goto** (ADR-028) — Use structured programming patterns
4. **Increment/decrement** (ADR-021) — Use compound assignment (`+<- 1`)

### Research (v2 Roadmap)

| Feature                    | ADR     | Notes                          |
| -------------------------- | ------- | ------------------------------ |
| ISR Safety                 | ADR-009 | Safe interrupts without unsafe |
| Multi-core Synchronization | ADR-100 | v2                             |
| Heap Allocation            | ADR-101 | v2                             |
| Stream Handling            | ADR-103 | FILE\* and fopen patterns      |
