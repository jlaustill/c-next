# C-Next Language Test Coverage Matrix

This document tracks test coverage for every language construct in every valid context.
**Goal: 100% language coverage before v1 release.**

## Recent Updates

**2026-01-11: Comprehensive Postfix Expression Chain Testing**

- ✅ Added 11 new test files targeting lines 5850-6285 (most complex code in transpiler)
- ✅ Fixed grammar bug (lines 485-486 in CNext.g4) - parser now accepts complex chains
- 🔶 Discovered code generator bug - order scrambling in mixed chains (documented)
- 📊 Coverage increased from ~60% to ~62% overall
- 📄 See [BUG-DISCOVERED-postfix-chains.md](../BUG-DISCOVERED-postfix-chains.md) for details

## How to Use This Document

- Each section lists a language construct category
- Sub-sections list valid contexts where constructs can appear
- Checkboxes track test coverage:
  - `[ ]` = No test exists
  - `[x]` = Test exists and passes
- Error tests are marked with **(ERROR)** suffix
- File references link to actual test files in `tests/` directory

---

## Table of Contents

1. [Primitive Types](#1-primitive-types)
2. [Assignment Operators](#2-assignment-operators)
3. [Comparison Operators](#3-comparison-operators)
4. [Arithmetic Operators](#4-arithmetic-operators)
5. [Bitwise Operators](#5-bitwise-operators)
6. [Logical Operators](#6-logical-operators)
7. [Control Flow](#7-control-flow)
8. [Ternary Operator](#8-ternary-operator)
9. [Struct Declaration](#9-struct-declaration)
10. [Enum Declaration](#10-enum-declaration)
11. [Bitmap Declaration](#11-bitmap-declaration)
12. [Register Declaration](#12-register-declaration) (includes Bitfields)
13. [Scope Declaration](#13-scope-declaration) (includes Scoped/Qualified Types)
14. [Functions](#14-functions)
15. [Callbacks](#15-callbacks)
16. [Arrays](#16-arrays)
17. [Bit Indexing](#17-bit-indexing)
18. [Strings](#18-strings)
19. [Const Modifier](#19-const-modifier)
20. [Atomic Modifier](#20-atomic-modifier)
21. [Overflow Modifiers](#21-overflow-modifiers-clampwrap)
22. [Type Casting](#22-type-casting)
23. [sizeof Operator](#23-sizeof-operator)
24. [Preprocessor](#24-preprocessor)
25. [Comments](#25-comments)
26. [Initialization](#26-initialization)
27. [References](#27-references-pass-by-reference)
28. [NULL Interop](#28-null-interop)
29. [Static Allocation](#29-static-allocation)
30. [C Interoperability](#30-c-interoperability) (includes Volatile)
31. [ISR Type](#31-isr-type)
32. [Literals](#32-literals)
33. [Generic Types](#33-generic-types)
34. [Expression Contexts](#34-expression-contexts)

---

## 1. Primitive Types

### 1.1 Unsigned Integers

#### u8

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [x]    |                                                 |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/u8-multi-dim.test.cnx`        |
| In arithmetic expression       | [x]    |                                                 |
| In comparison                  | [x]    |                                                 |
| In bitwise operation           | [x]    | `bitwise/u8-bitwise-ops.test.cnx`               |
| As loop counter                | [x]    | `for-loops/for-u8-counter.test.cnx`             |
| In ternary expression          | [ ]    |                                                 |
| With const modifier            | [x]    | `const/const-variable.test.cnx`                 |
| With atomic modifier           | [x]    | `atomic/atomic-all-types.test.cnx`              |
| With clamp modifier            | [ ]    |                                                 |
| With wrap modifier             | [ ]    |                                                 |
| In scope declaration           | [ ]    |                                                 |
| In register field              | [x]    |                                                 |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

#### u16

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [x]    |                                                 |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/u16-multi-dim.test.cnx`       |
| In arithmetic expression       | [x]    |                                                 |
| In comparison                  | [x]    |                                                 |
| In bitwise operation           | [x]    | `bitwise/u16-bitwise-ops.test.cnx`              |
| As loop counter                | [x]    | `for-loops/for-u16-counter.test.cnx`            |
| In ternary expression          | [ ]    |                                                 |
| With const modifier            | [x]    | `const/const-u16-variable.test.cnx`             |
| With atomic modifier           | [x]    | `atomic/atomic-all-types.test.cnx`              |
| With clamp modifier            | [x]    | `const/const-clamp-u16.test.cnx`                |
| With wrap modifier             | [x]    | `const/const-wrap-u16.test.cnx`                 |
| In scope declaration           | [ ]    |                                                 |
| In register field              | [x]    |                                                 |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

#### u32

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [x]    |                                                 |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/basic-2d.test.cnx`            |
| In arithmetic expression       | [x]    |                                                 |
| In comparison                  | [x]    |                                                 |
| In bitwise operation           | [x]    |                                                 |
| As loop counter                | [x]    | `for-loops/for-basic.test.cnx`                  |
| In ternary expression          | [x]    | `ternary/ternary-basic.test.cnx`                |
| With const modifier            | [x]    | `const/const-variable.test.cnx`                 |
| With atomic modifier           | [x]    | `atomic/basic.test.cnx`                         |
| With clamp modifier            | [x]    | `primitives/clamp-declaration.test.cnx`         |
| With wrap modifier             | [x]    | `primitives/wrap-declaration.test.cnx`          |
| In scope declaration           | [x]    | `scope/this-global-test.test.cnx`               |
| In register field              | [x]    | `register/register-basic.test.cnx`              |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

#### u64

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [x]    | `array-initializers/u64-array-init.test.cnx`    |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/u64-multi-dim.test.cnx`       |
| In arithmetic expression       | [x]    | `arithmetic/u64-arithmetic.test.cnx`            |
| In comparison                  | [x]    | `comparison/u64-comparison.test.cnx`            |
| In bitwise operation           | [x]    | `bitwise/u64-bitwise-ops.test.cnx`              |
| As loop counter                | [x]    | `for-loops/for-u64-counter.test.cnx`            |
| In ternary expression          | [x]    | `ternary/ternary-u64.test.cnx`                  |
| With const modifier            | [x]    | `const/const-u64-variable.test.cnx`             |
| With atomic modifier           | [x]    | `atomic/atomic-all-types.test.cnx`              |
| With clamp modifier            | [ ]    |                                                 |
| With wrap modifier             | [ ]    |                                                 |
| In scope declaration           | [ ]    |                                                 |
| In register field              | [ ]    |                                                 |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

### 1.2 Signed Integers

#### i8

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [ ]    |                                                 |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/i8-multi-dim.test.cnx`        |
| In arithmetic expression       | [x]    | `arithmetic/i8-arithmetic.test.cnx`             |
| In comparison                  | [x]    | `comparison/i8-comparison.test.cnx`             |
| In bitwise operation           | [x]    | `bitwise/i8-bitwise-ops.test.cnx`               |
| As loop counter                | [x]    | `for-loops/for-i8-counter.test.cnx`             |
| Negative literal assignment    | [x]    | `arithmetic/i8-arithmetic.test.cnx`             |
| With const modifier            | [x]    | `const/const-i8-variable.test.cnx`              |
| With atomic modifier           | [x]    | `atomic/atomic-all-types.test.cnx`              |
| With clamp modifier            | [ ]    |                                                 |
| With wrap modifier             | [ ]    |                                                 |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

#### i16

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [ ]    |                                                 |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/i16-multi-dim.test.cnx`       |
| In arithmetic expression       | [x]    | `arithmetic/i16-arithmetic.test.cnx`            |
| In comparison                  | [x]    | `comparison/i16-comparison.test.cnx`            |
| In bitwise operation           | [x]    | `bitwise/i16-bitwise-ops.test.cnx`              |
| As loop counter                | [x]    | `for-loops/for-i16-counter.test.cnx`            |
| Negative literal assignment    | [x]    | `arithmetic/i16-arithmetic.test.cnx`            |
| With const modifier            | [x]    | `const/const-i16-variable.test.cnx`             |
| With atomic modifier           | [x]    | `atomic/atomic-all-types.test.cnx`              |
| With clamp modifier            | [ ]    |                                                 |
| With wrap modifier             | [ ]    |                                                 |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

#### i32

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [ ]    |                                                 |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/i32-multi-dim.test.cnx`       |
| In arithmetic expression       | [x]    |                                                 |
| In comparison                  | [x]    |                                                 |
| In bitwise operation           | [x]    | `bitwise/i32-bitwise-ops.test.cnx`              |
| As loop counter                | [ ]    |                                                 |
| Negative literal assignment    | [x]    |                                                 |
| With const modifier            | [x]    |                                                 |
| With atomic modifier           | [x]    | `atomic/atomic-all-types.test.cnx`              |
| With clamp modifier            | [x]    | `primitives/signed-overflow.test.cnx`           |
| With wrap modifier             | [x]    | `primitives/signed-overflow.test.cnx`           |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

#### i64

| Context                        | Status | Test File                                       |
| ------------------------------ | ------ | ----------------------------------------------- |
| Global variable declaration    | [x]    | `primitives/all-types.test.cnx`                 |
| Global variable with init      | [x]    |                                                 |
| Local variable declaration     | [x]    |                                                 |
| Local variable with init       | [x]    |                                                 |
| Function parameter             | [x]    |                                                 |
| Function return type           | [x]    |                                                 |
| Struct member                  | [x]    |                                                 |
| Array element type             | [ ]    |                                                 |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/i64-multi-dim.test.cnx`       |
| In arithmetic expression       | [x]    | `arithmetic/i64-arithmetic.test.cnx`            |
| In comparison                  | [x]    | `comparison/i64-comparison.test.cnx`            |
| In bitwise operation           | [x]    | `bitwise/i64-bitwise-ops.test.cnx`              |
| As loop counter                | [x]    | `for-loops/for-i64-counter.test.cnx`            |
| Negative literal assignment    | [x]    | `arithmetic/i64-arithmetic.test.cnx`            |
| With const modifier            | [x]    | `const/const-i64-variable.test.cnx`             |
| With atomic modifier           | [x]    | `atomic/atomic-all-types.test.cnx`              |
| With clamp modifier            | [ ]    |                                                 |
| With wrap modifier             | [ ]    |                                                 |
| .length property               | [x]    | `primitives/length-property-all-types.test.cnx` |

### 1.3 Floating Point

#### f32

| Context                        | Status | Test File                                 |
| ------------------------------ | ------ | ----------------------------------------- |
| Global variable declaration    | [x]    | `floats/f32-all-contexts.test.cnx`        |
| Global variable with init      | [x]    | `floats/f32-all-contexts.test.cnx`        |
| Local variable declaration     | [x]    | `floats/f32-all-contexts.test.cnx`        |
| Local variable with init       | [x]    | `floats/f32-all-contexts.test.cnx`        |
| Function parameter             | [x]    | `floats/f32-all-contexts.test.cnx`        |
| Function return type           | [x]    | `floats/f32-all-contexts.test.cnx`        |
| Struct member                  | [x]    | `floats/f32-all-contexts.test.cnx`        |
| Array element type             | [x]    | `floats/float-arrays.test.cnx`            |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/f32-multi-dim.test.cnx` |
| In arithmetic expression       | [x]    | `floats/float-arithmetic.test.cnx`        |
| In comparison                  | [x]    | `floats/float-comparison.test.cnx`        |
| Literal with decimal           | [x]    | `floats/float-literals.test.cnx`          |
| Literal with f32 suffix        | [x]    | `floats/float-literal-suffixes.test.cnx`  |

#### f64

| Context                        | Status | Test File                                 |
| ------------------------------ | ------ | ----------------------------------------- |
| Global variable declaration    | [x]    | `floats/f64-all-contexts.test.cnx`        |
| Global variable with init      | [x]    | `floats/f64-all-contexts.test.cnx`        |
| Local variable declaration     | [x]    | `floats/f64-all-contexts.test.cnx`        |
| Local variable with init       | [x]    | `floats/f64-all-contexts.test.cnx`        |
| Function parameter             | [x]    | `floats/f64-all-contexts.test.cnx`        |
| Function return type           | [x]    | `floats/f64-all-contexts.test.cnx`        |
| Struct member                  | [x]    | `floats/f64-all-contexts.test.cnx`        |
| Array element type             | [x]    | `floats/float-arrays.test.cnx`            |
| Array element type (multi-dim) | [x]    | `multi-dim-arrays/f64-multi-dim.test.cnx` |
| In arithmetic expression       | [x]    | `floats/float-arithmetic.test.cnx`        |
| In comparison                  | [x]    | `floats/float-comparison.test.cnx`        |
| Literal with decimal           | [x]    | `floats/float-literals.test.cnx`          |
| Literal with f64 suffix        | [x]    | `floats/float-literal-suffixes.test.cnx`  |

### 1.4 Boolean

| Context                     | Status | Test File                                |
| --------------------------- | ------ | ---------------------------------------- | --- | --- |
| Global variable declaration | [x]    | `assignment/assignment-basic.test.cnx`   |
| Global variable with init   | [x]    |                                          |
| Local variable declaration  | [x]    |                                          |
| Local variable with init    | [x]    |                                          |
| Function parameter          | [x]    | `primitives/bool-all-contexts.test.cnx`  |
| Function return type        | [x]    | `primitives/bool-all-contexts.test.cnx`  |
| Struct member               | [x]    | `primitives/bool-all-contexts.test.cnx`  |
| Array element type          | [x]    | `primitives/bool-all-contexts.test.cnx`  |
| In if condition             | [x]    |                                          |
| In while condition          | [x]    |                                          |
| In for condition            | [x]    |                                          |
| In do-while condition       | [x]    | `do-while/do-while-boolean-var.test.cnx` |
| In ternary condition        | [x]    |                                          |
| Literal true                | [x]    |                                          |
| Literal false               | [x]    |                                          |
| Negation (!)                | [x]    |                                          |
| Logical AND (&&)            | [x]    |                                          |
| Logical OR (                |        | )                                        | [x] |     |

### 1.5 void

| Context                         | Status | Test File |
| ------------------------------- | ------ | --------- |
| Function return type            | [x]    | multiple  |
| In pointer type (not supported) | N/A    |           |

---

## 2. Assignment Operators

### 2.1 Simple Assignment (<-)

| Context                 | Status | Test File                                         |
| ----------------------- | ------ | ------------------------------------------------- |
| Global variable init    | [x]    | `assignment/assignment-basic.test.cnx`            |
| Local variable init     | [x]    |                                                   |
| Reassignment            | [x]    |                                                   |
| Struct member           | [x]    | `structs/struct-member-access.test.cnx`           |
| Nested struct member    | [x]    | `nested-structs/basic-nesting.test.cnx`           |
| Array element           | [x]    |                                                   |
| Multi-dim array element | [x]    | `multi-dim-arrays/basic-2d.test.cnx`              |
| Bit index (single)      | [x]    | `bit-indexing/bit-single-write.test.cnx`          |
| Bit range               | [x]    | `bit-indexing/bit-range-write.test.cnx`           |
| this.member             | [x]    | `scope/this-global-test.test.cnx`                 |
| global.member           | [x]    | `scope/global-compound-assign.test.cnx`           |
| Register field          | [x]    | `register/register-basic.test.cnx`                |
| Callback variable       | [x]    | `callbacks/callback-assign.test.cnx`              |
| Array of struct member  | [x]    | `static-allocation/static-struct-buffer.test.cnx` |

### 2.2 Compound Assignment (+<-)

| Context                 | Status | Test File                                                                                                     |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Variable                | [x]    | `primitives/compound-assignment.test.cnx`                                                                     |
| Array element           | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`                                                                |
| Multi-dim array element | [x]    | `multi-dim-arrays/compound-assign-2d.test.cnx`, `compound-assign-3d.test.cnx`, `compound-assign-10d.test.cnx` |
| Struct member           | [x]    | `multi-dim-arrays/struct-member-compound.test.cnx`                                                            |
| Bit index               | [ ]    |                                                                                                               |
| this.member             | [x]    | `scope/scope-compound-assign.test.cnx`                                                                        |
| global.member           | [x]    | `scope/global-compound-assign.test.cnx`                                                                       |
| Cross-scope             | [x]    | `scope/cross-scope-compound.test.cnx`                                                                         |

### 2.3 Compound Assignment (-<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.4 Compound Assignment (\*<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.5 Compound Assignment (/<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.6 Compound Assignment (%<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.7 Compound Assignment (&<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.8 Compound Assignment (|<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.9 Compound Assignment (^<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.10 Compound Assignment (<<<-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

### 2.11 Compound Assignment (>><-)

| Context              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Variable             | [x]    | `primitives/compound-assignment.test.cnx`         |
| Array element        | [x]    | `multi-dim-arrays/compound-assign-1d.test.cnx`    |
| Struct member        | [x]    | `structs/struct-compound-all-ops.test.cnx`        |
| Nested struct member | [x]    | `nested-structs/nested-compound-all-ops.test.cnx` |
| this.member          | [ ]    |                                                   |
| global.member        | [ ]    |                                                   |

---

## 3. Comparison Operators

### 3.1 Equality (=)

| Operand Types                       | Status | Test File                                 |
| ----------------------------------- | ------ | ----------------------------------------- |
| Integer = Integer                   | [x]    | `assignment/comparison-if.test.cnx`       |
| Integer = Literal                   | [x]    |                                           |
| Bool = Bool                         | [x]    |                                           |
| Bool = true/false                   | [x]    |                                           |
| Enum = Enum (same type)             | [x]    | `enum/basic-enum.test.cnx`                |
| Enum = Enum (diff type) **(ERROR)** | [x]    | `enum/enum-error-compare-types.test.cnx`  |
| Enum = Integer **(ERROR)**          | [x]    | `enum/enum-error-compare-int.test.cnx`    |
| String = String                     | [x]    | `string/string-compare-eq.test.cnx`       |
| String = Literal                    | [x]    | `string/string-compare-literal.test.cnx`  |
| Float = Float                       | [x]    | `floats/float-comparison.test.cnx`        |
| Float = Literal                     | [x]    | `floats/float-comparison.test.cnx`        |
| Pointer = NULL                      | [x]    | `null-check/valid-null-eq-check.test.cnx` |

### 3.2 Not Equal (!=)

| Operand Types      | Status | Test File                            |
| ------------------ | ------ | ------------------------------------ |
| Integer != Integer | [x]    |                                      |
| Integer != Literal | [x]    |                                      |
| Bool != Bool       | [x]    |                                      |
| Enum != Enum       | [x]    |                                      |
| String != String   | [x]    | `string/string-compare-neq.test.cnx` |
| Float != Float     | [x]    | `floats/float-comparison.test.cnx`   |
| Pointer != NULL    | [x]    | `null-check/null-neq-check.test.cnx` |

### 3.3 Less Than (<)

| Operand Types     | Status | Test File                            |
| ----------------- | ------ | ------------------------------------ |
| u8 < u8           | [ ]    |                                      |
| u16 < u16         | [ ]    |                                      |
| u32 < u32         | [x]    |                                      |
| u64 < u64         | [ ]    |                                      |
| i8 < i8           | [x]    | `comparison/i8-comparison.test.cnx`  |
| i16 < i16         | [x]    | `comparison/i16-comparison.test.cnx` |
| i32 < i32         | [x]    |                                      |
| i64 < i64         | [x]    | `comparison/i64-comparison.test.cnx` |
| f32 < f32         | [x]    | `floats/float-comparison.test.cnx`   |
| f64 < f64         | [x]    | `floats/float-comparison.test.cnx`   |
| Integer < Literal | [x]    |                                      |
| Literal < Integer | [ ]    |                                      |

### 3.4 Greater Than (>)

| Operand Types     | Status | Test File                            |
| ----------------- | ------ | ------------------------------------ |
| u8 > u8           | [ ]    |                                      |
| u16 > u16         | [ ]    |                                      |
| u32 > u32         | [x]    |                                      |
| u64 > u64         | [ ]    |                                      |
| i8 > i8           | [x]    | `comparison/i8-comparison.test.cnx`  |
| i16 > i16         | [x]    | `comparison/i16-comparison.test.cnx` |
| i32 > i32         | [x]    |                                      |
| i64 > i64         | [x]    | `comparison/i64-comparison.test.cnx` |
| f32 > f32         | [x]    | `floats/float-comparison.test.cnx`   |
| f64 > f64         | [x]    | `floats/float-comparison.test.cnx`   |
| Integer > Literal | [x]    |                                      |

### 3.5 Less Than or Equal (<=)

| Operand Types | Status | Test File                            |
| ------------- | ------ | ------------------------------------ |
| u32 <= u32    | [x]    |                                      |
| i8 <= i8      | [x]    | `comparison/i8-comparison.test.cnx`  |
| i16 <= i16    | [x]    | `comparison/i16-comparison.test.cnx` |
| i32 <= i32    | [x]    |                                      |
| i64 <= i64    | [x]    | `comparison/i64-comparison.test.cnx` |
| f32 <= f32    | [x]    | `floats/float-comparison.test.cnx`   |
| f64 <= f64    | [x]    | `floats/float-comparison.test.cnx`   |
| Other types   | [ ]    |                                      |

### 3.6 Greater Than or Equal (>=)

| Operand Types | Status | Test File                            |
| ------------- | ------ | ------------------------------------ |
| u32 >= u32    | [x]    |                                      |
| i8 >= i8      | [x]    | `comparison/i8-comparison.test.cnx`  |
| i16 >= i16    | [x]    | `comparison/i16-comparison.test.cnx` |
| i32 >= i32    | [x]    |                                      |
| i64 >= i64    | [x]    | `comparison/i64-comparison.test.cnx` |
| f32 >= f32    | [x]    | `floats/float-comparison.test.cnx`   |
| f64 >= f64    | [x]    | `floats/float-comparison.test.cnx`   |
| Other types   | [ ]    |                                      |

---

## 4. Arithmetic Operators

### 4.1 Addition (+)

| Operand Types            | Status | Test File                                |
| ------------------------ | ------ | ---------------------------------------- |
| u8 + u8                  | [ ]    |                                          |
| u16 + u16                | [ ]    |                                          |
| u32 + u32                | [x]    |                                          |
| u64 + u64                | [ ]    |                                          |
| i8 + i8                  | [x]    | `arithmetic/i8-arithmetic.test.cnx`      |
| i16 + i16                | [x]    | `arithmetic/i16-arithmetic.test.cnx`     |
| i32 + i32                | [x]    |                                          |
| i64 + i64                | [x]    | `arithmetic/i64-arithmetic.test.cnx`     |
| f32 + f32                | [x]    | `floats/float-arithmetic.test.cnx`       |
| f64 + f64                | [x]    | `floats/float-arithmetic.test.cnx`       |
| Integer + Literal        | [x]    |                                          |
| With clamp (saturating)  | [x]    | `primitives/clamp-compound-add.test.cnx` |
| With wrap (wrapping)     | [x]    | `primitives/wrap-compound-add.test.cnx`  |
| String + String (concat) | [x]    | `string/string-concat-basic.test.cnx`    |

### 4.2 Subtraction (-)

| Operand Types       | Status | Test File                            |
| ------------------- | ------ | ------------------------------------ |
| u8 - u8             | [ ]    |                                      |
| u16 - u16           | [ ]    |                                      |
| u32 - u32           | [x]    |                                      |
| u64 - u64           | [ ]    |                                      |
| i8 - i8             | [x]    | `arithmetic/i8-arithmetic.test.cnx`  |
| i16 - i16           | [x]    | `arithmetic/i16-arithmetic.test.cnx` |
| i32 - i32           | [x]    |                                      |
| i64 - i64           | [x]    | `arithmetic/i64-arithmetic.test.cnx` |
| f32 - f32           | [x]    | `floats/float-arithmetic.test.cnx`   |
| f64 - f64           | [x]    | `floats/float-arithmetic.test.cnx`   |
| Integer - Literal   | [x]    |                                      |
| Unary negation (-x) | [x]    |                                      |

### 4.3 Multiplication (\*)

| Operand Types      | Status | Test File                            |
| ------------------ | ------ | ------------------------------------ |
| u32 \* u32         | [x]    |                                      |
| i8 \* i8           | [x]    | `arithmetic/i8-arithmetic.test.cnx`  |
| i16 \* i16         | [x]    | `arithmetic/i16-arithmetic.test.cnx` |
| i32 \* i32         | [x]    |                                      |
| i64 \* i64         | [x]    | `arithmetic/i64-arithmetic.test.cnx` |
| f32 \* f32         | [x]    | `floats/float-arithmetic.test.cnx`   |
| f64 \* f64         | [x]    | `floats/float-arithmetic.test.cnx`   |
| Integer \* Literal | [x]    |                                      |

### 4.4 Division (/)

| Operand Types                           | Status | Test File                                         |
| --------------------------------------- | ------ | ------------------------------------------------- |
| u32 / u32                               | [x]    |                                                   |
| i8 / i8                                 | [x]    | `arithmetic/i8-arithmetic.test.cnx`               |
| i16 / i16                               | [x]    | `arithmetic/i16-arithmetic.test.cnx`              |
| i32 / i32                               | [x]    |                                                   |
| i64 / i64                               | [x]    | `arithmetic/i64-arithmetic.test.cnx`              |
| f32 / f32                               | [x]    | `floats/float-arithmetic.test.cnx`                |
| f64 / f64                               | [x]    | `floats/float-arithmetic.test.cnx`                |
| Integer / Literal                       | [x]    |                                                   |
| Float division by zero (valid)          | [x]    | `floats/float-division-by-zero.test.cnx`          |
| Float division by const zero (valid)    | [x]    | `floats/float-const-zero-valid.test.cnx`          |
| Division by zero **(ERROR)**            | [x]    | `arithmetic/division-by-zero-literal.test.cnx`    |
| Division by const zero **(ERROR)**      | [x]    | `arithmetic/division-by-const-zero.test.cnx`      |
| Division const zero formats **(ERROR)** | [x]    | `arithmetic/division-const-zero-formats.test.cnx` |
| Division by const non-zero              | [x]    | `arithmetic/division-const-non-zero.test.cnx`     |
| Safe division (ADR-051)                 | [x]    | `arithmetic/safe-div-basic.test.cnx`              |
| Safe div preserve on error              | [x]    | `arithmetic/safe-div-preserve-on-error.test.cnx`  |
| Safe div all types                      | [x]    | `arithmetic/safe-div-all-types.test.cnx`          |

### 4.5 Modulo (%)

| Operand Types                    | Status | Test File                                    |
| -------------------------------- | ------ | -------------------------------------------- |
| u32 % u32                        | [x]    |                                              |
| i8 % i8                          | [x]    | `arithmetic/i8-arithmetic.test.cnx`          |
| i16 % i16                        | [x]    | `arithmetic/i16-arithmetic.test.cnx`         |
| i32 % i32                        | [x]    |                                              |
| i64 % i64                        | [x]    | `arithmetic/i64-arithmetic.test.cnx`         |
| Integer % Literal                | [x]    |                                              |
| Modulo by zero **(ERROR)**       | [x]    | `arithmetic/modulo-by-zero-literal.test.cnx` |
| Modulo by const zero **(ERROR)** | [x]    | `arithmetic/modulo-by-const-zero.test.cnx`   |
| Safe modulo (ADR-051)            | [x]    | `arithmetic/safe-mod-basic.test.cnx`         |
| Float modulo **(ERROR)**         | [x]    | `floats/float-modulo-error.test.cnx`         |

---

## 5. Bitwise Operators

### 5.1 AND (&)

| Operand Types       | Status | Test File |
| ------------------- | ------ | --------- |
| u8 & u8             | [ ]    |           |
| u16 & u16           | [ ]    |           |
| u32 & u32           | [x]    |           |
| u64 & u64           | [ ]    |           |
| i8 & i8             | [ ]    |           |
| i16 & i16           | [ ]    |           |
| i32 & i32           | [ ]    |           |
| i64 & i64           | [ ]    |           |
| Integer & Literal   | [x]    |           |
| With hex literal    | [ ]    |           |
| With binary literal | [ ]    |           |

### 5.2 OR (|)

| Operand Types       | Status | Test File |
| ------------------- | ------ | --------- |
| u8 \| u8            | [ ]    |           |
| u16 \| u16          | [ ]    |           |
| u32 \| u32          | [x]    |           |
| u64 \| u64          | [ ]    |           |
| Integer \| Literal  | [x]    |           |
| With hex literal    | [ ]    |           |
| With binary literal | [ ]    |           |

### 5.3 XOR (^)

| Operand Types     | Status | Test File |
| ----------------- | ------ | --------- |
| u8 ^ u8           | [ ]    |           |
| u16 ^ u16         | [ ]    |           |
| u32 ^ u32         | [x]    |           |
| u64 ^ u64         | [ ]    |           |
| Integer ^ Literal | [x]    |           |

### 5.4 NOT (~)

| Operand Types | Status | Test File |
| ------------- | ------ | --------- |
| ~u8           | [ ]    |           |
| ~u16          | [ ]    |           |
| ~u32          | [x]    |           |
| ~u64          | [ ]    |           |
| ~i8           | [ ]    |           |
| ~i16          | [ ]    |           |
| ~i32          | [ ]    |           |
| ~i64          | [ ]    |           |

### 5.5 Left Shift (<<)

| Operand Types                  | Status | Test File |
| ------------------------------ | ------ | --------- |
| u8 << amount                   | [ ]    |           |
| u16 << amount                  | [ ]    |           |
| u32 << amount                  | [x]    |           |
| u64 << amount                  | [ ]    |           |
| Shift by literal               | [x]    |           |
| Shift by variable              | [ ]    |           |
| Shift beyond width **(ERROR)** | [ ]    |           |

### 5.6 Right Shift (>>)

| Operand Types              | Status | Test File |
| -------------------------- | ------ | --------- |
| u8 >> amount               | [ ]    |           |
| u16 >> amount              | [ ]    |           |
| u32 >> amount              | [x]    |           |
| u64 >> amount              | [ ]    |           |
| i32 >> amount (arithmetic) | [ ]    |           |
| Shift by literal           | [x]    |           |
| Shift by variable          | [ ]    |           |

---

## 6. Logical Operators

### 6.1 AND (&&)

| Context                  | Status | Test File                                                                     |
| ------------------------ | ------ | ----------------------------------------------------------------------------- |
| In if condition          | [x]    |                                                                               |
| In while condition       | [x]    |                                                                               |
| In for condition         | [x]    |                                                                               |
| In do-while condition    | [x]    | `do-while/do-while-logical.test.cnx`                                          |
| In ternary condition     | [x]    | `ternary/ternary-logical.test.cnx`                                            |
| As standalone expression | [ ]    |                                                                               |
| Short-circuit evaluation | [x]    | `logical/and-short-circuit.test.cnx`, `logical/short-circuit-safety.test.cnx` |
| With bool operands       | [x]    |                                                                               |
| With comparison operands | [x]    |                                                                               |
| Chained (a && b && c)    | [ ]    |                                                                               |

### 6.2 OR (||)

| Context                   | Status | Test File                                                                    |
| ------------------------- | ------ | ---------------------------------------------------------------------------- |
| In if condition           | [x]    |                                                                              |
| In while condition        | [x]    |                                                                              |
| In for condition          | [x]    |                                                                              |
| In do-while condition     | [x]    |                                                                              |
| In ternary condition      | [x]    |                                                                              |
| As standalone expression  | [ ]    |                                                                              |
| Short-circuit evaluation  | [x]    | `logical/or-short-circuit.test.cnx`, `logical/short-circuit-safety.test.cnx` |
| In switch case labels     | [x]    | `switch/switch-multiple-cases.test.cnx`                                      |
| Chained (a \|\| b \|\| c) | [ ]    |                                                                              |

### 6.3 NOT (!)

| Context              | Status | Test File |
| -------------------- | ------ | --------- |
| !bool_var            | [x]    |           |
| !comparison          | [x]    |           |
| In if condition      | [x]    |           |
| In while condition   | [x]    |           |
| In ternary condition | [ ]    |           |
| Double negation (!!) | [ ]    |           |

---

## 7. Control Flow

### 7.1 if Statement

| Variant                           | Status | Test File                                     |
| --------------------------------- | ------ | --------------------------------------------- |
| Simple if                         | [x]    | `assignment/comparison-if.test.cnx`           |
| if with block                     | [x]    |                                               |
| if-else                           | [x]    |                                               |
| if-else if-else                   | [x]    |                                               |
| Nested if                         | [ ]    |                                               |
| if inside loop                    | [x]    |                                               |
| if inside scope                   | [x]    |                                               |
| if inside critical                | [x]    | `critical/critical-with-conditional.test.cnx` |
| Non-boolean condition **(ERROR)** | [ ]    |                                               |

### 7.2 while Loop

| Variant                           | Status | Test File                              |
| --------------------------------- | ------ | -------------------------------------- |
| Simple while                      | [x]    | `assignment/comparison-while.test.cnx` |
| While with block                  | [x]    |                                        |
| While with counter                | [x]    |                                        |
| Nested while                      | [ ]    |                                        |
| While inside if                   | [ ]    |                                        |
| While inside scope                | [ ]    |                                        |
| Non-boolean condition **(ERROR)** | [ ]    |                                        |
| Infinite while (while true)       | [ ]    |                                        |

### 7.3 do-while Loop

| Variant                           | Status | Test File                                      |
| --------------------------------- | ------ | ---------------------------------------------- |
| Simple do-while                   | [x]    | `do-while/do-while-basic.test.cnx`             |
| With equality condition           | [x]    | `do-while/do-while-equality.test.cnx`          |
| With logical condition            | [x]    | `do-while/do-while-logical.test.cnx`           |
| With boolean variable             | [x]    | `do-while/do-while-boolean-var.test.cnx`       |
| Nested do-while                   | [ ]    |                                                |
| do-while inside if                | [ ]    |                                                |
| Non-boolean condition **(ERROR)** | [x]    | `do-while/do-while-error-non-boolean.test.cnx` |

### 7.4 for Loop

| Variant                           | Status | Test File                                |
| --------------------------------- | ------ | ---------------------------------------- |
| Basic for                         | [x]    | `for-loops/for-basic.test.cnx`           |
| Array iteration                   | [x]    | `for-loops/for-array-iteration.test.cnx` |
| Nested for                        | [x]    | `for-loops/for-nested.test.cnx`          |
| For with compound update          | [ ]    |                                          |
| For with multiple init            | [ ]    |                                          |
| For with empty init               | [ ]    |                                          |
| For with empty condition          | [ ]    |                                          |
| For with empty update             | [ ]    |                                          |
| For inside if                     | [ ]    |                                          |
| For inside scope                  | [ ]    |                                          |
| Non-boolean condition **(ERROR)** | [ ]    |                                          |

### 7.5 switch Statement

| Variant                         | Status | Test File                                         |
| ------------------------------- | ------ | ------------------------------------------------- |
| Basic integer switch            | [x]    | `switch/switch-basic.test.cnx`                    |
| All integer types (u8-i64)      | [x]    | `switch/switch-integer-types.test.cnx`            |
| Enum exhaustive                 | [x]    | `switch/switch-enum-exhaustive.test.cnx`          |
| Multiple cases (\|\|)           | [x]    | `switch/switch-multiple-cases.test.cnx`           |
| Multiple cases execution        | [x]    | `switch/switch-multiple-cases-execution.test.cnx` |
| Counted default                 | [x]    | `switch/switch-enum-default-counted.test.cnx`     |
| Hex literal cases               | [x]    | `switch/switch-literal-types.test.cnx`            |
| Binary literal cases            | [x]    | `switch/switch-literal-types.test.cnx`            |
| Char literal cases              | [x]    | `switch/switch-literal-types.test.cnx`            |
| Nested switch                   | [x]    | `switch/switch-nested.test.cnx`                   |
| Switch inside loop              | [x]    | `switch/switch-in-function.test.cnx`              |
| Switch with return values       | [x]    | `switch/switch-in-function.test.cnx`              |
| Recursive function with switch  | [x]    | `switch/switch-in-function.test.cnx`              |
| Switch inside scope             | [ ]    |                                                   |
| Boolean switch **(ERROR)**      | [x]    | `switch/switch-error-boolean.test.cnx`            |
| Single case **(ERROR)**         | [x]    | `switch/switch-error-single-case.test.cnx`        |
| Duplicate case **(ERROR)**      | [x]    | `switch/switch-error-duplicate-case.test.cnx`     |
| Non-exhaustive enum **(ERROR)** | [x]    | `switch/switch-error-non-exhaustive.test.cnx`     |
| Wrong default count **(ERROR)** | [x]    | `switch/switch-error-wrong-count.test.cnx`        |

### 7.6 return Statement

| Context                        | Status | Test File                        |
| ------------------------------ | ------ | -------------------------------- |
| Return void                    | [x]    |                                  |
| Return value                   | [x]    |                                  |
| Return expression              | [x]    |                                  |
| Return in if branch            | [x]    |                                  |
| Return in else branch          | [x]    |                                  |
| Return in loop                 | [x]    |                                  |
| Return in critical **(ERROR)** | [x]    | `critical/return-error.test.cnx` |
| Early return                   | [x]    |                                  |
| Return ternary result          | [x]    |                                  |

### 7.7 critical Block

| Variant                   | Status | Test File                                     |
| ------------------------- | ------ | --------------------------------------------- |
| Basic critical            | [x]    | `critical/basic.test.cnx`                     |
| With conditional          | [x]    | `critical/critical-with-conditional.test.cnx` |
| Multi-variable            | [x]    | `critical/multi-variable.test.cnx`            |
| Nested critical           | [ ]    |                                               |
| Critical in loop          | [ ]    |                                               |
| Critical in if            | [ ]    |                                               |
| Return inside **(ERROR)** | [x]    | `critical/return-error.test.cnx`              |

### 7.8 break Statement

| Variant                     | Status | Test File                                       |
| --------------------------- | ------ | ----------------------------------------------- |
| break in for loop           | [x]    | `control-flow/break-for-basic.test.cnx`         |
| break in while loop         | [x]    | `control-flow/break-while.test.cnx`             |
| break in do-while loop      | [x]    | `control-flow/break-do-while.test.cnx`          |
| break in nested for         | [x]    | `control-flow/nested-break.test.cnx`            |
| break in nested while       | [x]    | `control-flow/nested-break.test.cnx`            |
| break in nested do-while    | [x]    | `control-flow/nested-break.test.cnx`            |
| break with condition        | [x]    | `control-flow/break-for-comprehensive.test.cnx` |
| break in 3-level nesting    | [x]    | `control-flow/nested-break.test.cnx`            |
| mixed loop types with break | [x]    | `control-flow/nested-break.test.cnx`            |

### 7.9 continue Statement

| Variant                     | Status | Test File                                 |
| --------------------------- | ------ | ----------------------------------------- |
| continue in for loop        | [x]    | `control-flow/continue-for.test.cnx`      |
| continue in while loop      | [x]    | `control-flow/continue-while.test.cnx`    |
| continue in do-while loop   | [x]    | `control-flow/continue-do-while.test.cnx` |
| continue in nested for      | [x]    | `control-flow/nested-continue.test.cnx`   |
| continue in nested while    | [x]    | `control-flow/nested-continue.test.cnx`   |
| continue in nested do-while | [x]    | `control-flow/nested-continue.test.cnx`   |
| continue with condition     | [x]    | `control-flow/continue-for.test.cnx`      |
| continue in 3-level nesting | [x]    | `control-flow/nested-continue.test.cnx`   |
| mixed break/continue        | [x]    | `control-flow/nested-mixed.test.cnx`      |

---

## 8. Ternary Operator

| Variant                           | Status | Test File                                    |
| --------------------------------- | ------ | -------------------------------------------- |
| Basic ternary                     | [x]    | `ternary/ternary-basic.test.cnx`             |
| With equality condition           | [x]    | `ternary/ternary-equality.test.cnx`          |
| With relational condition         | [x]    |                                              |
| With logical condition            | [x]    | `ternary/ternary-logical.test.cnx`           |
| In return statement               | [x]    |                                              |
| In assignment                     | [x]    |                                              |
| In function argument              | [ ]    |                                              |
| With function calls as values     | [ ]    |                                              |
| Non-boolean condition **(ERROR)** | [x]    | `ternary/ternary-error-non-boolean.test.cnx` |
| Nested ternary **(ERROR)**        | [x]    | `ternary/ternary-error-nested.test.cnx`      |
| Missing parentheses **(ERROR)**   | [x]    | `ternary/ternary-error-no-parens.test.cnx`   |

---

## 9. Struct Declaration

| Feature                            | Status | Test File                                         |
| ---------------------------------- | ------ | ------------------------------------------------- |
| Basic declaration                  | [x]    | `structs/struct-declaration.test.cnx`             |
| With primitive members             | [x]    |                                                   |
| With array member                  | [x]    | `structs/struct-with-array.test.cnx`              |
| With nested struct                 | [x]    | `nested-structs/basic-nesting.test.cnx`           |
| Deep nesting (3+ levels)           | [x]    | `nested-structs/deep-nesting.test.cnx`            |
| Zero initialization                | [x]    |                                                   |
| Named field initialization         | [x]    | `structs/struct-initialization.test.cnx`          |
| Member access (.)                  | [x]    | `structs/struct-member-access.test.cnx`           |
| Chained member access              | [x]    | `nested-structs/basic-nesting.test.cnx`           |
| As function parameter              | [x]    | `structs/struct-function-param.test.cnx`          |
| Nested as parameter                | [x]    | `nested-structs/function-params.test.cnx`         |
| As function return                 | [ ]    |                                                   |
| Const struct                       | [x]    | `structs/struct-const.test.cnx`                   |
| Array of structs                   | [x]    | `array-initializers/struct-array.test.cnx`        |
| Array of struct member access      | [x]    | `static-allocation/static-struct-buffer.test.cnx` |
| Struct in scope                    | [ ]    |                                                   |
| Redundant type in init **(ERROR)** | [x]    | `structs/struct-redundant-type-error.test.cnx`    |

---

## 10. Enum Declaration

| Feature                             | Status | Test File                                |
| ----------------------------------- | ------ | ---------------------------------------- |
| Basic enum                          | [x]    | `enum/basic-enum.test.cnx`               |
| With explicit values                | [x]    |                                          |
| With auto-increment values          | [x]    |                                          |
| Scoped enum                         | [x]    | `enum/scoped-enum.test.cnx`              |
| Enum in switch                      | [x]    | `switch/switch-enum-exhaustive.test.cnx` |
| Enum comparison (same type)         | [x]    |                                          |
| Enum as function parameter          | [ ]    |                                          |
| Enum as function return             | [ ]    |                                          |
| Cast to integer                     | [ ]    |                                          |
| Compare different types **(ERROR)** | [x]    | `enum/enum-error-compare-types.test.cnx` |
| Compare with int **(ERROR)**        | [x]    | `enum/enum-error-compare-int.test.cnx`   |
| Assign int **(ERROR)**              | [x]    | `enum/enum-error-assign-int.test.cnx`    |
| Negative value **(ERROR)**          | [x]    | `enum/enum-error-negative.test.cnx`      |

---

## 11. Bitmap Declaration

| Feature                         | Status | Test File                               |
| ------------------------------- | ------ | --------------------------------------- |
| bitmap8 basic                   | [x]    | `bitmap/basic-bitmap.test.cnx`          |
| bitmap16                        | [x]    | `bitmap/bitmap-16.test.cnx`             |
| bitmap24                        | [ ]    |                                         |
| bitmap32                        | [ ]    |                                         |
| Single-bit field                | [x]    |                                         |
| Multi-bit field                 | [x]    |                                         |
| In register                     | [x]    | `bitmap/bitmap-in-register.test.cnx`    |
| As variable type                | [x]    |                                         |
| As struct member                | [ ]    |                                         |
| Bit overflow **(ERROR)**        | [x]    | `bitmap/bitmap-error-overflow.test.cnx` |
| Total bits mismatch **(ERROR)** | [x]    | `bitmap/bitmap-error-bits.test.cnx`     |

---

## 12. Register Declaration

| Feature                    | Status | Test File                                     |
| -------------------------- | ------ | --------------------------------------------- |
| Basic register             | [x]    | `register/register-basic.test.cnx`            |
| Multiple registers         | [x]    | `register/register-multiple.test.cnx`         |
| With address offset        | [x]    | `register/register-offsets.test.cnx`          |
| rw access modifier         | [x]    | `register/register-access-modifiers.test.cnx` |
| ro access modifier         | [x]    |                                               |
| wo access modifier         | [x]    |                                               |
| w1c access modifier        | [ ]    |                                               |
| w1s access modifier        | [ ]    |                                               |
| Bit indexing               | [x]    | `register/register-bit-indexing.test.cnx`     |
| Bit range access           | [ ]    |                                               |
| Bitfield members           | [ ]    |                                               |
| Scoped register            | [x]    | `scope/scoped-register-basic.test.cnx`        |
| Scoped register bit access | [x]    | `scope/scoped-register-bit-access.test.cnx`   |
| Write to ro **(ERROR)**    | [x]    | `register/register-write-ro-error.test.cnx`   |
| Read from wo **(ERROR)**   | [x]    | `register/register-read-wo-error.test.cnx`    |

### 12.2 Register Bitfields (bits keyword)

**STATUS: NOT VALID C-NEXT SYNTAX** - The `bits[start..end]` syntax has been removed from the grammar. Attempting to use it will produce a parse error.

**Note:** Use **bitmap types** instead (Section 11). Bitmaps are fully implemented and provide the same functionality with better reusability. The blink example demonstrates this pattern: define a `bitmap32` type, then use it as the register member type.

| Feature                             | Status | Test File                                      |
| ----------------------------------- | ------ | ---------------------------------------------- |
| bits[start..end] syntax **(ERROR)** | [x]    | `register/register-bits-syntax-error.test.cnx` |

---

## 13. Scope Declaration

| Feature                              | Status | Test File                               |
| ------------------------------------ | ------ | --------------------------------------- |
| Basic scope                          | [x]    | `scope/this-global-test.test.cnx`       |
| Scope with variables                 | [x]    |                                         |
| Scope with functions                 | [x]    |                                         |
| Scope with structs                   | [ ]    |                                         |
| Scope with enums                     | [x]    | `enum/scoped-enum.test.cnx`             |
| Scope with registers                 | [x]    | `scope/scoped-register-basic.test.cnx`  |
| this.member access                   | [x]    |                                         |
| this.member assignment               | [x]    |                                         |
| this.member compound assign          | [x]    | `scope/scope-compound-assign.test.cnx`  |
| this. with all primitive types       | [x]    | `scope/this-all-types.test.cnx`         |
| global.member access                 | [x]    |                                         |
| global.member assignment             | [x]    |                                         |
| global.member compound assign        | [x]    | `scope/global-compound-assign.test.cnx` |
| global. with all primitive types     | [x]    | `scope/global-all-types.test.cnx`       |
| Cross-scope access                   | [x]    | `scope/cross-scope-compound.test.cnx`   |
| private visibility                   | [x]    | `scope/scope-public-private.test.cnx`   |
| public visibility                    | [x]    | `scope/scope-public-private.test.cnx`   |
| clamp modifier in scope              | [x]    | `scope/scope-clamp-modifier.test.cnx`   |
| wrap modifier in scope               | [x]    | `scope/scope-wrap-modifier.test.cnx`    |
| Bare identifier in scope **(ERROR)** | [x]    | `scope/bare-identifier-error.test.cnx`  |
| Bare global access **(ERROR)**       | [x]    | `scope/bare-global-error.test.cnx`      |
| Nested scopes **(ERROR)**            | [x]    | `scope/nested-scope-error.test.cnx`     |

### 13.2 Scoped Types (this.Type)

| Feature                | Status | Test File |
| ---------------------- | ------ | --------- |
| this.Type declaration  | [ ]    |           |
| this.Type as parameter | [ ]    |           |
| this.Type as return    | [ ]    |           |
| this.Type as variable  | [ ]    |           |

### 13.3 Qualified Types (Scope.Type)

| Feature                 | Status | Test File                   |
| ----------------------- | ------ | --------------------------- |
| Scope.Type reference    | [x]    | `enum/scoped-enum.test.cnx` |
| Scope.Type as parameter | [ ]    |                             |
| Scope.Type as return    | [ ]    |                             |
| Scope.Enum.VALUE access | [x]    |                             |

---

## 14. Functions

| Feature                        | Status | Test File                                                |
| ------------------------------ | ------ | -------------------------------------------------------- |
| Basic function                 | [x]    |                                                          |
| With parameters                | [x]    |                                                          |
| With return value              | [x]    |                                                          |
| Void return                    | [x]    |                                                          |
| Multiple parameters            | [x]    |                                                          |
| Const parameters               | [x]    | `const/const-parameter.test.cnx`                         |
| Array parameters               | [x]    |                                                          |
| Struct parameters              | [x]    | `structs/struct-function-param.test.cnx`                 |
| Nested struct parameters       | [x]    | `nested-structs/function-params.test.cnx`                |
| main() no args                 | [x]    | `functions/main-no-args.test.cnx`                        |
| main() with args               | [x]    | `functions/main-with-args.test.cnx`                      |
| main() with 2D array           | [x]    | `functions/main-2d-array.test.cnx`                       |
| Define before use              | [x]    | `forward-declarations/define-before-use-valid.test.cnx`  |
| Nested calls                   | [x]    | `forward-declarations/nested-calls-valid.test.cnx`       |
| Call before define **(ERROR)** | [x]    | `forward-declarations/call-before-define-error.test.cnx` |
| Recursive call **(ERROR)**     | [x]    | `forward-declarations/recursive-call-error.test.cnx`     |
| Function in scope              | [x]    |                                                          |

---

## 15. Callbacks

| Feature                           | Status | Test File                                   |
| --------------------------------- | ------ | ------------------------------------------- |
| Basic callback type               | [x]    | `callbacks/callback-basic.test.cnx`         |
| Callback assignment               | [x]    | `callbacks/callback-assign.test.cnx`        |
| Callback as parameter             | [x]    | `callbacks/callback-param.test.cnx`         |
| Callback invocation               | [x]    |                                             |
| Array of callbacks                | [ ]    |                                             |
| Callback as struct member         | [ ]    |                                             |
| Nominal type mismatch **(ERROR)** | [x]    | `callbacks/callback-error-nominal.test.cnx` |

---

## 16. Arrays

### 16.1 Single-dimensional

| Feature                   | Status | Test File                                    |
| ------------------------- | ------ | -------------------------------------------- |
| Declaration with size     | [x]    |                                              |
| Declaration with init     | [x]    | `array-initializers/basic-init.test.cnx`     |
| Inferred size             | [x]    | `array-initializers/size-inference.test.cnx` |
| Fill-all [0*]             | [x]    | `array-initializers/fill-all.test.cnx`       |
| Const array               | [x]    | `array-initializers/const-tables.test.cnx`   |
| Array of structs          | [x]    | `array-initializers/struct-array.test.cnx`   |
| .length property          | [x]    | `bit-indexing/length-property.test.cnx`      |
| Element access            | [x]    |                                              |
| Element assignment        | [x]    |                                              |
| In for loop               | [x]    | `for-loops/for-array-iteration.test.cnx`     |
| As function parameter     | [x]    |                                              |
| Out of bounds **(ERROR)** | [ ]    |                                              |

### 16.2 Multi-dimensional

| Feature                  | Status | Test File                                          |
| ------------------------ | ------ | -------------------------------------------------- |
| 2D declaration           | [x]    | `multi-dim-arrays/basic-2d.test.cnx`               |
| 3D declaration           | [x]    | `multi-dim-arrays/basic-3d.test.cnx`               |
| Nested initialization    | [x]    | `multi-dim-arrays/nested-init.test.cnx`            |
| .length per dimension    | [x]    | `multi-dim-arrays/length-property.test.cnx`        |
| As struct member         | [x]    | `multi-dim-arrays/struct-member.test.cnx`          |
| Compound assignment      | [x]    | `multi-dim-arrays/compound-assign-2d.test.cnx`     |
| Struct member compound   | [x]    | `multi-dim-arrays/struct-member-compound.test.cnx` |
| Bounds check **(ERROR)** | [x]    | `multi-dim-arrays/bounds-error.test.cnx`           |

---

## 17. Bit Indexing

| Feature                         | Status | Test File                                 |
| ------------------------------- | ------ | ----------------------------------------- |
| Single bit read                 | [x]    | `bit-indexing/bit-single-read.test.cnx`   |
| Single bit write                | [x]    | `bit-indexing/bit-single-write.test.cnx`  |
| Bit range read                  | [x]    | `bit-indexing/bit-range-read.test.cnx`    |
| Bit range write                 | [x]    | `bit-indexing/bit-range-write.test.cnx`   |
| .length property                | [x]    | `bit-indexing/length-property.test.cnx`   |
| On u8                           | [ ]    |                                           |
| On u16                          | [ ]    |                                           |
| On u32                          | [x]    |                                           |
| On u64                          | [ ]    |                                           |
| On register fields              | [x]    | `register/register-bit-indexing.test.cnx` |
| On wo register (optimized)      | [x]    |                                           |
| For narrowing cast              | [x]    | `casting/bit-index-narrowing.test.cnx`    |
| For sign cast                   | [x]    | `casting/bit-index-sign.test.cnx`         |
| Variable index                  | [ ]    |                                           |
| Expression index                | [ ]    |                                           |
| Out of bounds index **(ERROR)** | [ ]    |                                           |

---

## 18. Strings

| Feature                         | Status | Test File                                       |
| ------------------------------- | ------ | ----------------------------------------------- |
| Basic declaration               | [x]    | `string/string-basic.test.cnx`                  |
| Empty string                    | [x]    | `string/string-empty.test.cnx`                  |
| .length property                | [x]    | `string/string-length.test.cnx`                 |
| .capacity property              | [x]    | `string/string-capacity.test.cnx`               |
| .size property                  | [x]    | `string/string-size.test.cnx`                   |
| Const inference                 | [x]    | `string/string-const-inference.test.cnx`        |
| Compare =                       | [x]    | `string/string-compare-eq.test.cnx`             |
| Compare !=                      | [x]    | `string/string-compare-neq.test.cnx`            |
| Compare with literal            | [x]    | `string/string-compare-literal.test.cnx`        |
| Concatenation                   | [x]    | `string/string-concat-basic.test.cnx`           |
| Concat with literal             | [x]    | `string/string-concat-literal.test.cnx`         |
| Substring                       | [x]    | `string/string-substring.test.cnx`              |
| Substring with offset           | [x]    | `string/string-substring-offset.test.cnx`       |
| Function parameter              | [x]    | `string/string-function-param.test.cnx`         |
| As struct member                | [ ]    |                                                 |
| Array of strings                | [ ]    |                                                 |
| Overflow **(ERROR)**            | [x]    | `string/string-error-overflow.test.cnx`         |
| Const no init **(ERROR)**       | [x]    | `string/string-error-const-no-init.test.cnx`    |
| Non-const unsized **(ERROR)**   | [x]    | `string/string-error-nonconst-unsized.test.cnx` |
| Concat overflow **(ERROR)**     | [x]    | `string/string-error-concat-overflow.test.cnx`  |
| Substring bounds **(ERROR)**    | [x]    | `string/string-error-substring-bounds.test.cnx` |
| Substring dest size **(ERROR)** | [x]    | `string/string-error-substring-dest.test.cnx`   |

---

## 19. Const Modifier

| Context                           | Status | Test File                                    |
| --------------------------------- | ------ | -------------------------------------------- |
| Global variable                   | [x]    | `const/const-variable.test.cnx`              |
| Local variable                    | [x]    |                                              |
| Function parameter                | [x]    | `const/const-parameter.test.cnx`             |
| Array element type                | [x]    | `array-initializers/const-tables.test.cnx`   |
| Struct member                     | [ ]    |                                              |
| String (inferred)                 | [x]    | `string/string-const-inference.test.cnx`     |
| Assign to const **(ERROR)**       | [x]    | `const/const-assign-error.test.cnx`          |
| Compound assign const **(ERROR)** | [x]    | `const/const-compound-assign-error.test.cnx` |
| Assign const param **(ERROR)**    | [x]    | `const/const-param-assign-error.test.cnx`    |
| u16 variable                      | [x]    | `const/const-u16-variable.test.cnx`          |
| u64 variable                      | [x]    | `const/const-u64-variable.test.cnx`          |
| i8 variable                       | [x]    | `const/const-i8-variable.test.cnx`           |
| i16 variable                      | [x]    | `const/const-i16-variable.test.cnx`          |
| i64 variable                      | [x]    | `const/const-i64-variable.test.cnx`          |
| bool variable                     | [x]    | `const/const-bool-variable.test.cnx`         |
| f32 variable                      | [x]    | `const/const-f32-variable.test.cnx`          |
| f64 variable                      | [x]    | `const/const-f64-variable.test.cnx`          |
| u16 parameter                     | [x]    | `const/const-u16-parameter.test.cnx`         |
| u64 parameter                     | [x]    | `const/const-u64-parameter.test.cnx`         |
| i8 parameter                      | [x]    | `const/const-i8-parameter.test.cnx`          |
| i16 parameter                     | [x]    | `const/const-i16-parameter.test.cnx`         |
| i64 parameter                     | [x]    | `const/const-i64-parameter.test.cnx`         |
| bool parameter                    | [x]    | `const/const-bool-parameter.test.cnx`        |
| f32 parameter                     | [x]    | `const/const-f32-parameter.test.cnx`         |
| f64 parameter                     | [x]    | `const/const-f64-parameter.test.cnx`         |
| const + clamp u8                  | [x]    | `const/const-clamp-u8.test.cnx`              |
| const + clamp u16                 | [x]    | `const/const-clamp-u16.test.cnx`             |
| const + wrap u8                   | [x]    | `const/const-wrap-u8.test.cnx`               |
| const + wrap u16                  | [x]    | `const/const-wrap-u16.test.cnx`              |

---

## 20. Atomic Modifier

| Context             | Status | Test File                             |
| ------------------- | ------ | ------------------------------------- |
| Basic atomic        | [x]    | `atomic/basic.test.cnx`               |
| All integer types   | [x]    | `atomic/atomic-all-types.test.cnx`    |
| Compound operations | [x]    | `atomic/atomic-compound-ops.test.cnx` |
| PRIMASK fallback    | [x]    | `atomic/primask-fallback.test.cnx`    |
| With clamp          | [ ]    |                                       |
| With wrap           | [ ]    |                                       |
| In scope            | [ ]    |                                       |
| As struct member    | [ ]    |                                       |
| In critical section | [ ]    |                                       |

---

## 21. Overflow Modifiers (clamp/wrap)

### 21.1 clamp (Saturating)

| Context          | Status | Test File                                |
| ---------------- | ------ | ---------------------------------------- |
| u8 clamp         | [ ]    |                                          |
| u16 clamp        | [ ]    |                                          |
| u32 clamp        | [x]    | `primitives/clamp-declaration.test.cnx`  |
| u64 clamp        | [ ]    |                                          |
| i8 clamp         | [ ]    |                                          |
| i16 clamp        | [ ]    |                                          |
| i32 clamp        | [x]    | `primitives/signed-overflow.test.cnx`    |
| i64 clamp        | [ ]    |                                          |
| Compound add     | [x]    | `primitives/clamp-compound-add.test.cnx` |
| Compound sub     | [ ]    |                                          |
| Compound mul     | [ ]    |                                          |
| With atomic      | [ ]    |                                          |
| Overflow to max  | [x]    |                                          |
| Underflow to min | [ ]    |                                          |

### 21.2 wrap (Wrapping)

| Context      | Status | Test File                               |
| ------------ | ------ | --------------------------------------- |
| u8 wrap      | [x]    | `overflow-modifiers/wrap-u8.test.cnx`   |
| u16 wrap     | [x]    | `overflow-modifiers/wrap-u16.test.cnx`  |
| u32 wrap     | [x]    | `primitives/wrap-declaration.test.cnx`  |
| u64 wrap     | [x]    | `overflow-modifiers/wrap-u64.test.cnx`  |
| i8 wrap      | [x]    | `overflow-modifiers/wrap-i8.test.cnx`   |
| i16 wrap     | [x]    | `overflow-modifiers/wrap-i16.test.cnx`  |
| i32 wrap     | [x]    | `primitives/signed-overflow.test.cnx`   |
| i64 wrap     | [x]    | `overflow-modifiers/wrap-i64.test.cnx`  |
| Compound add | [x]    | `primitives/wrap-compound-add.test.cnx` |
| Compound sub | [ ]    |                                         |
| Compound mul | [ ]    |                                         |
| With atomic  | [ ]    |                                         |
| Wrap around  | [x]    |                                         |

### 21.3 Mixed Overflow

| Feature                  | Status | Test File                            |
| ------------------------ | ------ | ------------------------------------ |
| Mixed in expression      | [x]    | `primitives/mixed-overflow.test.cnx` |
| clamp + wrap interaction | [x]    |                                      |

---

## 22. Type Casting

| Conversion                          | Status | Test File                                          |
| ----------------------------------- | ------ | -------------------------------------------------- |
| Widening unsigned (u8 -> u16)       | [x]    | `casting/widening-unsigned.test.cnx`               |
| Widening signed (i8 -> i16)         | [x]    | `casting/widening-signed.test.cnx`                 |
| Explicit cast (u32)                 | [x]    |                                                    |
| Literal in range                    | [x]    | `casting/literal-valid.test.cnx`                   |
| Enum to int cast                    | [ ]    |                                                    |
| Narrowing assign **(ERROR)**        | [x]    | `casting/narrowing-assign-error.test.cnx`          |
| Narrowing cast **(ERROR)**          | [x]    | `casting/narrowing-cast-error.test.cnx`            |
| Sign assign **(ERROR)**             | [x]    | `casting/sign-assign-error.test.cnx`               |
| Sign cast **(ERROR)**               | [x]    | `casting/sign-cast-error.test.cnx`                 |
| Literal overflow **(ERROR)**        | [x]    | `casting/literal-overflow-error.test.cnx`          |
| Literal neg to unsigned **(ERROR)** | [x]    | `casting/literal-negative-unsigned-error.test.cnx` |
| Literal hex overflow **(ERROR)**    | [x]    | `casting/literal-hex-overflow-error.test.cnx`      |
| Literal binary overflow **(ERROR)** | [x]    | `casting/literal-binary-overflow-error.test.cnx`   |
| Bit index narrowing                 | [x]    | `casting/bit-index-narrowing.test.cnx`             |
| Bit index sign                      | [x]    | `casting/bit-index-sign.test.cnx`                  |

---

## 23. sizeof Operator

| Context                     | Status | Test File                            |
| --------------------------- | ------ | ------------------------------------ |
| Primitive type              | [x]    | `sizeof/basic-type.test.cnx`         |
| Variable                    | [x]    | `sizeof/basic-variable.test.cnx`     |
| Struct type                 | [x]    | `sizeof/struct-type.test.cnx`        |
| Local array                 | [ ]    |                                      |
| Struct member               | [ ]    |                                      |
| In expression               | [ ]    |                                      |
| In array size               | [ ]    |                                      |
| Array parameter **(ERROR)** | [x]    | `sizeof/array-param-error.test.cnx`  |
| Side effects **(ERROR)**    | [x]    | `sizeof/side-effects-error.test.cnx` |

---

## 24. Preprocessor

| Directive                  | Status | Test File                                       |
| -------------------------- | ------ | ----------------------------------------------- |
| #include <system>          | [x]    | `c-interop/include-passthrough.test.cnx`        |
| #include "local"           | [x]    |                                                 |
| #define FLAG (valid)       | [x]    | `preprocessor/flag-define-valid.test.cnx`       |
| #ifdef / #endif            | [x]    | `preprocessor/conditional-compilation.test.cnx` |
| #ifndef / #else / #endif   | [x]    |                                                 |
| #pragma target             | [x]    | `platformio-detect/auto-detect.test.cnx`        |
| Nested #ifdef              | [ ]    |                                                 |
| #define VALUE **(ERROR)**  | [x]    | `preprocessor/value-define-error.test.cnx`      |
| #define FUNC() **(ERROR)** | [x]    | `preprocessor/function-macro-error.test.cnx`    |

---

## 25. Comments

| Type                            | Status | Test File                                  |
| ------------------------------- | ------ | ------------------------------------------ |
| Line comment //                 | [x]    | `comments/basic-comments.test.cnx`         |
| Block comment /\* \*/           | [x]    |                                            |
| Doc comment ///                 | [x]    | `comments/doc-comments.test.cnx`           |
| URI exception                   | [x]    | `comments/uri-exception.test.cnx`          |
| Multi-line block                | [x]    |                                            |
| Comment in expression           | [ ]    |                                            |
| MISRA 3.1 nested **(ERROR)**    | [x]    | `comments/misra-3-1-nested-block.test.cnx` |
| MISRA 3.2 backslash **(ERROR)** | [x]    | `comments/misra-3-2-backslash.test.cnx`    |

---

## 26. Initialization

| Context                         | Status | Test File                                   |
| ------------------------------- | ------ | ------------------------------------------- |
| Zero-init global                | [x]    | `initialization/global-zero-init.test.cnx`  |
| Zero-init array                 | [x]    | `initialization/array-zero-init.test.cnx`   |
| Zero-init struct                | [x]    | `initialization/struct-zero-init.test.cnx`  |
| Counter from zero               | [x]    | `initialization/counter-from-zero.test.cnx` |
| Init then use                   | [x]    | `initialization/init-then-use.test.cnx`     |
| If-else branches                | [x]    | `initialization/if-else-branches.test.cnx`  |
| Namespace init                  | [x]    | `initialization/namespace-init.test.cnx`    |
| Loop init                       | [ ]    |                                             |
| Switch branch init              | [ ]    |                                             |
| Use before init **(ERROR)**     | [x]    | `initialization/use-before-init.test.cnx`   |
| Partial branch init **(ERROR)** | [ ]    |                                             |

---

## 27. References (Pass-by-reference)

| Feature                | Status | Test File                                |
| ---------------------- | ------ | ---------------------------------------- |
| Pass by reference      | [x]    | `references/pass-by-reference.test.cnx`  |
| Output parameter       | [x]    | `references/output-parameter.test.cnx`   |
| Struct pass by ref     | [x]    | `references/struct-pass-by-ref.test.cnx` |
| Swap function          | [x]    | `references/swap-function.test.cnx`      |
| Compound via ref       | [x]    | `references/compound-via-ref.test.cnx`   |
| Array pass by ref      | [ ]    |                                          |
| Multiple output params | [ ]    |                                          |
| Ref in loop            | [ ]    |                                          |

---

## 28. NULL Interop

| Feature                     | Status | Test File                                 |
| --------------------------- | ------ | ----------------------------------------- |
| fgets != NULL               | [x]    | `null-check/valid-fgets-check.test.cnx`   |
| fgets = NULL                | [x]    | `null-check/valid-null-eq-check.test.cnx` |
| fgets else branch           | [x]    | `null-check/valid-fgets-else.test.cnx`    |
| fputs check                 | [x]    | `null-check/valid-fputs-check.test.cnx`   |
| fgetc check                 | [x]    | `null-check/valid-fgetc-check.test.cnx`   |
| != NULL variant             | [x]    | `null-check/null-neq-check.test.cnx`      |
| NULL in while               | [ ]    |                                           |
| NULL in ternary             | [ ]    |                                           |
| Missing check **(ERROR)**   | [x]    | `null-check/missing-null-check.test.cnx`  |
| Invalid usage **(ERROR)**   | [x]    | `null-check/invalid-null-usage.test.cnx`  |
| fopen forbidden **(ERROR)** | [x]    | `null-check/forbidden-fopen.test.cnx`     |

---

## 29. Static Allocation

| Feature              | Status | Test File                                         |
| -------------------- | ------ | ------------------------------------------------- |
| Static array         | [x]    | `static-allocation/static-array.test.cnx`         |
| Static counter       | [x]    | `static-allocation/static-counter.test.cnx`       |
| Static struct buffer | [x]    | `static-allocation/static-struct-buffer.test.cnx` |
| Static string buffer | [ ]    |                                                   |
| malloc **(ERROR)**   | [x]    | `static-allocation/malloc-error.test.cnx`         |
| calloc **(ERROR)**   | [x]    | `static-allocation/calloc-error.test.cnx`         |
| realloc **(ERROR)**  | [x]    | `static-allocation/realloc-error.test.cnx`        |
| free **(ERROR)**     | [x]    | `static-allocation/free-error.test.cnx`           |

---

## 30. C Interoperability

| Feature               | Status | Test File                                                                                                     |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| C types compatibility | [x]    | `c-interop/c-types-compat.test.cnx`                                                                           |
| Generated C readable  | [x]    | `c-interop/generated-c-readable.test.cnx`                                                                     |
| Include passthrough   | [x]    | `c-interop/include-passthrough.test.cnx`                                                                      |
| Call C function       | [x]    | `c-interop/call-c-function-basic.test.cnx`, `call-c-function-types.test.cnx`, `call-c-function-void.test.cnx` |
| Use C typedef         | [x]    | `c-interop/use-c-typedef-basic.test.cnx`, `use-c-typedef-struct.test.cnx`                                     |
| Use C macro constant  | [x]    | `c-interop/use-c-macro-constant.test.cnx`                                                                     |
| Volatile qualifier    | [x]    | See Section 30a                                                                                               |

**Additional C Interop Tests:**

| Feature              | Test File                                     |
| -------------------- | --------------------------------------------- |
| Named C structs      | `c-interop/use-c-struct-named.test.cnx`       |
| Anonymous structs    | `c-interop/use-c-struct-anonymous.test.cnx`   |
| Nested structs       | `c-interop/use-c-struct-nested.test.cnx`      |
| Struct array fields  | `c-interop/use-c-struct-array-field.test.cnx` |
| Named enums          | `c-interop/use-c-enum-named.test.cnx`         |
| Enum explicit values | `c-interop/use-c-enum-values.test.cnx`        |
| Typedef enums        | `c-interop/use-c-enum-typedef.test.cnx`       |
| Named unions         | `c-interop/use-c-union-basic.test.cnx`        |
| Typedef unions       | `c-interop/use-c-union-typedef.test.cnx`      |
| Extern variables     | `c-interop/use-c-extern-var.test.cnx`         |

---

## 30a. Volatile Modifier

| Context                  | Status | Test File                                |
| ------------------------ | ------ | ---------------------------------------- |
| Global variable          | [x]    | `volatile/volatile-global.test.cnx`      |
| Local variable           | [x]    | `volatile/volatile-local.test.cnx`       |
| Struct member            | N/A    | Not supported in C-Next grammar          |
| Register field (implied) | N/A    | Not implemented yet (ADR-108 future)     |
| With const               | [x]    | `volatile/volatile-const.test.cnx`       |
| With atomic **(ERROR)**  | [x]    | `atomic/atomic-volatile-error.test.cnx`  |
| In for loop              | [x]    | `volatile/volatile-in-for-loop.test.cnx` |

**Implementation Note (ADR-108):**

ADR-108 marked "Implemented" (2026-01-10) with hardware testing on Nucleo-F446RE. Test suite now covers:

- Global volatile variables
- Local volatile variables (delay loop pattern)
- Volatile + const combination (hardware status register pattern)
- Volatile in for loops (loop counter pattern)
- Atomic + volatile combination (ERROR case)

**Not tested (not implemented):**

- Struct member volatile (not supported in C-Next grammar)
- Register field implied volatile (future enhancement per ADR-108)

See `/docs/decisions/adr-108-volatile-keyword.md` for implementation details and usage patterns.

---

## 31. ISR Type

| Feature          | Status | Test File                     |
| ---------------- | ------ | ----------------------------- |
| Basic ISR        | [x]    | `isr/isr-basic.test.cnx`      |
| ISR assignment   | [x]    | `isr/isr-assignment.test.cnx` |
| ISR array        | [x]    | `isr/isr-array.test.cnx`      |
| ISR as parameter | [ ]    |                               |
| ISR in struct    | [ ]    |                               |
| ISR invocation   | [ ]    |                               |

---

## 32. Literals

### 32.1 Integer Literals

| Format          | Context          | Status | Test File |
| --------------- | ---------------- | ------ | --------- |
| Decimal         | Variable init    | [x]    |           |
| Decimal         | Array element    | [x]    |           |
| Decimal         | Function arg     | [x]    |           |
| Decimal         | Comparison       | [x]    |           |
| Hex (0x)        | Variable init    | [x]    |           |
| Hex (0x)        | Bitwise op       | [x]    |           |
| Hex (0x)        | Register address | [x]    |           |
| Binary (0b)     | Variable init    | [x]    |           |
| Binary (0b)     | Bit mask         | [ ]    |           |
| With u8 suffix  | [ ]              |        |
| With u16 suffix | [ ]              |        |
| With u32 suffix | [ ]              |        |
| With i8 suffix  | [ ]              |        |
| With i16 suffix | [ ]              |        |
| With i32 suffix | [ ]              |        |

### 32.2 Float Literals

| Format            | Context       | Status | Test File                                |
| ----------------- | ------------- | ------ | ---------------------------------------- |
| Decimal (3.14)    | Variable init | [x]    | `floats/float-literals.test.cnx`         |
| Scientific (1e-5) | Variable init | [x]    | `floats/float-literals.test.cnx`         |
| With f32 suffix   | [x]           |        | `floats/float-literal-suffixes.test.cnx` |
| With f64 suffix   | [x]           |        | `floats/float-literal-suffixes.test.cnx` |

### 32.3 String Literals

| Context           | Status | Test File                                |
| ----------------- | ------ | ---------------------------------------- |
| Variable init     | [x]    | `string/string-basic.test.cnx`           |
| Function argument | [x]    |                                          |
| Comparison        | [x]    | `string/string-compare-literal.test.cnx` |
| Concatenation     | [x]    | `string/string-concat-literal.test.cnx`  |
| Empty string ""   | [x]    | `string/string-empty.test.cnx`           |
| Escape sequences  | [ ]    |                                          |

### 32.4 Character Literals

| Context          | Status | Test File |
| ---------------- | ------ | --------- |
| Variable init    | [ ]    |           |
| Array element    | [ ]    |           |
| Comparison       | [ ]    |           |
| In switch case   | [ ]    |           |
| Escape sequences | [ ]    |           |

### 32.5 Boolean Literals

| Literal | Context        | Status | Test File                                |
| ------- | -------------- | ------ | ---------------------------------------- |
| true    | Variable init  | [x]    |                                          |
| true    | Bit assignment | [x]    | `bit-indexing/bit-single-write.test.cnx` |
| true    | Comparison     | [x]    |                                          |
| false   | Variable init  | [x]    |                                          |
| false   | Bit assignment | [x]    |                                          |
| false   | Comparison     | [x]    |                                          |

---

## 33. Generic Types

| Feature                | Status | Test File |
| ---------------------- | ------ | --------- |
| Type<Arg> declaration  | [ ]    |           |
| Type<Arg1, Arg2>       | [ ]    |           |
| Generic function       | [ ]    |           |
| Generic struct         | [ ]    |           |
| Numeric type parameter | [ ]    |           |

_Note: Generic types are defined in grammar but implementation status unclear._

---

## 34. Expression Contexts

### 34.1 Nested/Complex Expressions

| Context                            | Status | Test File                                          |
| ---------------------------------- | ------ | -------------------------------------------------- |
| Nested function calls              | [x]    | `forward-declarations/nested-calls-valid.test.cnx` |
| Chained member access              | [x]    | `nested-structs/basic-nesting.test.cnx`            |
| Array in array                     | [x]    | `multi-dim-arrays/nested-init.test.cnx`            |
| Arithmetic in comparison           | [x]    |                                                    |
| Comparison in logical              | [x]    |                                                    |
| Function call in expression        | [x]    |                                                    |
| Ternary in function arg            | [ ]    |                                                    |
| Ternary in array index             | [ ]    |                                                    |
| Ternary in return                  | [x]    |                                                    |
| Multiple operators same precedence | [ ]    |                                                    |
| Parenthesized sub-expressions      | [x]    |                                                    |

### 34.3 Postfix Expression Chains

**Comprehensive testing of lines 5850-6285 in CodeGenerator.ts (most complex code)**

| Context                                       | Status | Test File                                              |
| --------------------------------------------- | ------ | ------------------------------------------------------ |
| 2-level chains: arr[i].field                  | [x]    | `postfix-chains/basic-two-level.test.cnx`              |
| 3-level chains: arr[i].struct.field           | [x]    | `postfix-chains/deep-three-plus-levels.test.cnx`       |
| 4-level chains: arr[i][j].struct.field        | [x]    | `postfix-chains/deep-three-plus-levels.test.cnx`       |
| 5-level chains: arr[i][j].struct.field.member | [x]    | `postfix-chains/array-struct-chain.test.cnx`           |
| 7-level chains: mega stress test              | [x]    | `postfix-chains/mixed-access-ultimate.test.cnx`        |
| Register + bitmap + bit indexing              | [x]    | `postfix-chains/register-bitmap-bit-chain.test.cnx`    |
| Scoped register + bitmap chains               | [x]    | `postfix-chains/scoped-register-bitmap-chain.test.cnx` |
| Array + struct member chains                  | [x]    | `postfix-chains/array-struct-chain.test.cnx`           |
| Function calls with chained params            | [x]    | `postfix-chains/function-call-chain.test.cnx`          |
| Write-only register chains                    | [x]    | `postfix-chains/write-only-register-chain.test.cnx`    |
| Multi-bit range chains [start, width]         | [x]    | `postfix-chains/multi-bit-range-chain.test.cnx`        |
| Boundary conditions (max indices)             | [x]    | `postfix-chains/boundary-conditions.test.cnx`          |
| Const expressions as indices                  | [x]    | `postfix-chains/const-expression-chain.test.cnx`       |

**Note:** Tests created 2026-01-11. Grammar bug fixed (line 485-486 in CNext.g4). Code generator bug discovered and documented in `BUG-DISCOVERED-postfix-chains.md`.

### 34.2 Statement Nesting

| Context              | Status | Test File                            |
| -------------------- | ------ | ------------------------------------ |
| if inside if         | [ ]    |                                      |
| if inside while      | [x]    |                                      |
| if inside for        | [x]    |                                      |
| while inside if      | [ ]    |                                      |
| while inside while   | [ ]    |                                      |
| for inside for       | [x]    | `for-loops/for-nested.test.cnx`      |
| for inside if        | [ ]    |                                      |
| switch inside if     | [ ]    |                                      |
| switch inside loop   | [x]    | `switch/switch-in-function.test.cnx` |
| critical inside if   | [ ]    |                                      |
| critical inside loop | [ ]    |                                      |
| 3+ levels of nesting | [ ]    |                                      |

---

## Priority Summary

### High Priority (Core Language Gaps)

- [ ] Float types (f32, f64) - all contexts
- [ ] Character literals
- [ ] Type-suffixed literals (42u8, etc.)
- [x] Boolean as function parameter/return (`primitives/bool-all-contexts.test.cnx`)
- [ ] Nested control flow combinations
- [ ] All compound operators on array/struct targets

### Medium Priority (Safety Features)

- [ ] w1c/w1s register modifiers
- [ ] bitmap24 and bitmap32
- [ ] private/public visibility modifiers
- [ ] Enum to integer cast
- [ ] All types in bit indexing

### Low Priority (Edge Cases)

- [ ] Empty for loop components
- [ ] Nested scopes
- [ ] Deep nested control flow
- [ ] Float comparison edge cases
- [ ] Division/modulo by zero errors

---

## Statistics

_Last updated: 2026-01-11_

**Current Test Count: 262 test files** (190 success tests + 72 error tests)

| Category             | Estimated Coverage                                    |
| -------------------- | ----------------------------------------------------- |
| Primitive Types      | ~75% (f32/f64 now tested, gaps in u64/i64 operations) |
| Assignment Operators | ~65% (array + struct compound ops now tested)         |
| Comparison Operators | ~65% (float comparisons now tested)                   |
| Arithmetic Operators | ~50% (float ops now tested)                           |
| Bitwise Operators    | ~20% (only u32 well tested)                           |
| Logical Operators    | ~80% (short-circuit now tested, chaining gaps remain) |
| Control Flow         | ~95% (break/continue now fully tested)                |
| Type Declarations    | ~75% (structs/enums good, bitmaps sparse)             |
| Functions            | ~85% (solid basic coverage)                           |
| Arrays               | ~80% (good, some edge cases)                          |
| Strings              | ~90% (excellent coverage)                             |
| Modifiers            | ~60% (atomic good, volatile missing)                  |
| Register Bitfields   | ~10% (sparse)                                         |
| Generic Types        | ~0% (not tested)                                      |
| Statement Nesting    | ~30% (basic only)                                     |
| Postfix Chains       | ~95% (comprehensive 11-file test suite, code gen bug) |

**Overall Estimated Coverage: ~62%**

**Recent Improvements (2026-01-11):**

- ✅ Added comprehensive postfix expression chain testing (11 files)
- ✅ Fixed grammar bug (lines 485-486) - parser now accepts complex chains
- 🔶 Discovered code generator bug (lines 6715-6738) - order scrambling
- 📄 See `BUG-DISCOVERED-postfix-chains.md` for details

### Coverage by Test File Count

| Test Category      | Files   | Error Tests |
| ------------------ | ------- | ----------- |
| string             | 21      | 6           |
| scope              | 21      | 5           |
| casting            | 13      | 8           |
| arithmetic         | 12      | 3           |
| multi-dim-arrays   | 11      | 1           |
| postfix-chains     | 11      | 0           |
| floats             | 10      | 1           |
| switch             | 14      | 5           |
| null-check         | 9       | 5           |
| structs            | 8       | 1           |
| register           | 8       | 2           |
| primitives         | 8       | 0           |
| initialization     | 8       | 3           |
| static-allocation  | 7       | 4           |
| bitmap             | 7       | 2           |
| ternary            | 6       | 3           |
| enum               | 6       | 4           |
| nested-structs     | 5       | 0           |
| sizeof             | 5       | 2           |
| references         | 5       | 0           |
| do-while           | 5       | 1           |
| const              | 5       | 3           |
| comments           | 5       | 2           |
| bit-indexing       | 5       | 0           |
| atomic             | 5       | 1           |
| array-initializers | 5       | 0           |
| Other categories   | ~29     | ~5          |
| **TOTAL**          | **262** | **72**      |
