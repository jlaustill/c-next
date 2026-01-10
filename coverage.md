# C-Next Language Test Coverage Matrix

This document tracks test coverage for every language construct in every valid context.
**Goal: 100% language coverage before v1 release.**

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

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [x] | |
| Array element type (multi-dim) | [ ] | |
| In arithmetic expression | [x] | |
| In comparison | [x] | |
| In bitwise operation | [ ] | |
| As loop counter | [ ] | |
| In ternary expression | [ ] | |
| With const modifier | [x] | `const/const-variable.cnx` |
| With atomic modifier | [x] | `atomic/atomic-all-types.cnx` |
| With clamp modifier | [ ] | |
| With wrap modifier | [ ] | |
| In scope declaration | [ ] | |
| In register field | [x] | |

#### u16

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [x] | |
| Array element type (multi-dim) | [ ] | |
| In arithmetic expression | [x] | |
| In comparison | [x] | |
| In bitwise operation | [ ] | |
| As loop counter | [ ] | |
| In ternary expression | [ ] | |
| With const modifier | [ ] | |
| With atomic modifier | [x] | `atomic/atomic-all-types.cnx` |
| With clamp modifier | [ ] | |
| With wrap modifier | [ ] | |
| In scope declaration | [ ] | |
| In register field | [x] | |

#### u32

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [x] | |
| Array element type (multi-dim) | [x] | `multi-dim-arrays/basic-2d.cnx` |
| In arithmetic expression | [x] | |
| In comparison | [x] | |
| In bitwise operation | [x] | |
| As loop counter | [x] | `for-loops/for-basic.cnx` |
| In ternary expression | [x] | `ternary/ternary-basic.cnx` |
| With const modifier | [x] | `const/const-variable.cnx` |
| With atomic modifier | [x] | `atomic/basic.cnx` |
| With clamp modifier | [x] | `primitives/clamp-declaration.cnx` |
| With wrap modifier | [x] | `primitives/wrap-declaration.cnx` |
| In scope declaration | [x] | `scope/this-global-test.cnx` |
| In register field | [x] | `register/register-basic.cnx` |

#### u64

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [ ] | |
| Array element type (multi-dim) | [ ] | |
| In arithmetic expression | [ ] | |
| In comparison | [ ] | |
| In bitwise operation | [ ] | |
| As loop counter | [ ] | |
| In ternary expression | [ ] | |
| With const modifier | [ ] | |
| With atomic modifier | [x] | `atomic/atomic-all-types.cnx` |
| With clamp modifier | [ ] | |
| With wrap modifier | [ ] | |
| In scope declaration | [ ] | |
| In register field | [ ] | |

### 1.2 Signed Integers

#### i8

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [ ] | |
| In arithmetic expression | [ ] | |
| In comparison | [ ] | |
| Negative literal assignment | [ ] | |
| With const modifier | [ ] | |
| With atomic modifier | [x] | `atomic/atomic-all-types.cnx` |
| With clamp modifier | [ ] | |
| With wrap modifier | [ ] | |

#### i16

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [ ] | |
| In arithmetic expression | [ ] | |
| In comparison | [ ] | |
| Negative literal assignment | [x] | |
| With const modifier | [ ] | |
| With atomic modifier | [x] | `atomic/atomic-all-types.cnx` |
| With clamp modifier | [ ] | |
| With wrap modifier | [ ] | |

#### i32

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [ ] | |
| In arithmetic expression | [x] | |
| In comparison | [x] | |
| Negative literal assignment | [x] | |
| With const modifier | [x] | |
| With atomic modifier | [x] | `atomic/atomic-all-types.cnx` |
| With clamp modifier | [x] | `primitives/signed-overflow.cnx` |
| With wrap modifier | [x] | `primitives/signed-overflow.cnx` |

#### i64

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `primitives/all-types.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [x] | |
| Function return type | [x] | |
| Struct member | [x] | |
| Array element type | [ ] | |
| In arithmetic expression | [ ] | |
| In comparison | [ ] | |
| Negative literal assignment | [ ] | |
| With const modifier | [ ] | |
| With atomic modifier | [x] | `atomic/atomic-all-types.cnx` |
| With clamp modifier | [ ] | |
| With wrap modifier | [ ] | |

### 1.3 Floating Point

#### f32

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [ ] | |
| Global variable with init | [ ] | |
| Local variable declaration | [ ] | |
| Local variable with init | [ ] | |
| Function parameter | [ ] | |
| Function return type | [ ] | |
| Struct member | [ ] | |
| Array element type | [ ] | |
| In arithmetic expression | [ ] | |
| In comparison | [ ] | |
| Literal with decimal | [ ] | |
| Literal with f32 suffix | [ ] | |

#### f64

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [ ] | |
| Global variable with init | [ ] | |
| Local variable declaration | [ ] | |
| Local variable with init | [ ] | |
| Function parameter | [ ] | |
| Function return type | [ ] | |
| Struct member | [ ] | |
| Array element type | [ ] | |
| In arithmetic expression | [ ] | |
| In comparison | [ ] | |
| Literal with decimal | [ ] | |
| Literal with f64 suffix | [ ] | |

### 1.4 Boolean

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | `assignment/assignment-basic.cnx` |
| Global variable with init | [x] | |
| Local variable declaration | [x] | |
| Local variable with init | [x] | |
| Function parameter | [ ] | |
| Function return type | [ ] | |
| Struct member | [ ] | |
| Array element type | [ ] | |
| In if condition | [x] | |
| In while condition | [x] | |
| In for condition | [x] | |
| In do-while condition | [x] | `do-while/do-while-boolean-var.cnx` |
| In ternary condition | [x] | |
| Literal true | [x] | |
| Literal false | [x] | |
| Negation (!) | [x] | |
| Logical AND (&&) | [x] | |
| Logical OR (||) | [x] | |

### 1.5 void

| Context | Status | Test File |
|---------|--------|-----------|
| Function return type | [x] | multiple |
| In pointer type (not supported) | N/A | |

---

## 2. Assignment Operators

### 2.1 Simple Assignment (<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable init | [x] | `assignment/assignment-basic.cnx` |
| Local variable init | [x] | |
| Reassignment | [x] | |
| Struct member | [x] | `structs/struct-member-access.cnx` |
| Nested struct member | [x] | `nested-structs/basic-nesting.cnx` |
| Array element | [x] | |
| Multi-dim array element | [x] | `multi-dim-arrays/basic-2d.cnx` |
| Bit index (single) | [x] | `bit-indexing/bit-single-write.cnx` |
| Bit range | [x] | `bit-indexing/bit-range-write.cnx` |
| this.member | [x] | `scope/this-global-test.cnx` |
| global.member | [x] | `scope/global-compound-assign.cnx` |
| Register field | [x] | `register/register-basic.cnx` |
| Callback variable | [x] | `callbacks/callback-assign.cnx` |
| Array of struct member | [x] | `static-allocation/static-struct-buffer.cnx` |

### 2.2 Compound Assignment (+<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Multi-dim array element | [x] | `multi-dim-arrays/compound-assign-2d.cnx`, `compound-assign-3d.cnx`, `compound-assign-10d.cnx` |
| Struct member | [x] | `multi-dim-arrays/struct-member-compound.cnx` |
| Bit index | [ ] | |
| this.member | [x] | `scope/scope-compound-assign.cnx` |
| global.member | [x] | `scope/global-compound-assign.cnx` |
| Cross-scope | [x] | `scope/cross-scope-compound.cnx` |

### 2.3 Compound Assignment (-<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.4 Compound Assignment (*<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.5 Compound Assignment (/<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.6 Compound Assignment (%<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.7 Compound Assignment (&<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.8 Compound Assignment (|<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.9 Compound Assignment (^<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.10 Compound Assignment (<<<-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

### 2.11 Compound Assignment (>><-)

| Context | Status | Test File |
|---------|--------|-----------|
| Variable | [x] | `primitives/compound-assignment.cnx` |
| Array element | [x] | `multi-dim-arrays/compound-assign-1d.cnx` |
| Struct member | [x] | `structs/struct-compound-all-ops.cnx` |
| Nested struct member | [x] | `nested-structs/nested-compound-all-ops.cnx` |
| this.member | [ ] | |
| global.member | [ ] | |

---

## 3. Comparison Operators

### 3.1 Equality (=)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| Integer = Integer | [x] | `assignment/comparison-if.cnx` |
| Integer = Literal | [x] | |
| Bool = Bool | [x] | |
| Bool = true/false | [x] | |
| Enum = Enum (same type) | [x] | `enum/basic-enum.cnx` |
| Enum = Enum (diff type) **(ERROR)** | [x] | `enum/enum-error-compare-types.cnx` |
| Enum = Integer **(ERROR)** | [x] | `enum/enum-error-compare-int.cnx` |
| String = String | [x] | `string/string-compare-eq.cnx` |
| String = Literal | [x] | `string/string-compare-literal.cnx` |
| Float = Float | [ ] | |
| Float = Literal | [ ] | |
| Pointer = NULL | [x] | `null-check/valid-null-eq-check.cnx` |

### 3.2 Not Equal (!=)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| Integer != Integer | [x] | |
| Integer != Literal | [x] | |
| Bool != Bool | [x] | |
| Enum != Enum | [x] | |
| String != String | [x] | `string/string-compare-neq.cnx` |
| Float != Float | [ ] | |
| Pointer != NULL | [x] | `null-check/null-neq-check.cnx` |

### 3.3 Less Than (<)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 < u8 | [ ] | |
| u16 < u16 | [ ] | |
| u32 < u32 | [x] | |
| u64 < u64 | [ ] | |
| i8 < i8 | [ ] | |
| i16 < i16 | [ ] | |
| i32 < i32 | [x] | |
| i64 < i64 | [ ] | |
| f32 < f32 | [ ] | |
| f64 < f64 | [ ] | |
| Integer < Literal | [x] | |
| Literal < Integer | [ ] | |

### 3.4 Greater Than (>)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 > u8 | [ ] | |
| u16 > u16 | [ ] | |
| u32 > u32 | [x] | |
| u64 > u64 | [ ] | |
| i8 > i8 | [ ] | |
| i16 > i16 | [ ] | |
| i32 > i32 | [x] | |
| i64 > i64 | [ ] | |
| f32 > f32 | [ ] | |
| f64 > f64 | [ ] | |
| Integer > Literal | [x] | |

### 3.5 Less Than or Equal (<=)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u32 <= u32 | [x] | |
| i32 <= i32 | [x] | |
| Other types | [ ] | |

### 3.6 Greater Than or Equal (>=)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u32 >= u32 | [x] | |
| i32 >= i32 | [x] | |
| Other types | [ ] | |

---

## 4. Arithmetic Operators

### 4.1 Addition (+)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 + u8 | [ ] | |
| u16 + u16 | [ ] | |
| u32 + u32 | [x] | |
| u64 + u64 | [ ] | |
| i8 + i8 | [ ] | |
| i16 + i16 | [ ] | |
| i32 + i32 | [x] | |
| i64 + i64 | [ ] | |
| f32 + f32 | [ ] | |
| f64 + f64 | [ ] | |
| Integer + Literal | [x] | |
| With clamp (saturating) | [x] | `primitives/clamp-compound-add.cnx` |
| With wrap (wrapping) | [x] | `primitives/wrap-compound-add.cnx` |
| String + String (concat) | [x] | `string/string-concat-basic.cnx` |

### 4.2 Subtraction (-)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 - u8 | [ ] | |
| u16 - u16 | [ ] | |
| u32 - u32 | [x] | |
| u64 - u64 | [ ] | |
| i8 - i8 | [ ] | |
| i16 - i16 | [ ] | |
| i32 - i32 | [x] | |
| i64 - i64 | [ ] | |
| f32 - f32 | [ ] | |
| f64 - f64 | [ ] | |
| Integer - Literal | [x] | |
| Unary negation (-x) | [x] | |

### 4.3 Multiplication (*)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u32 * u32 | [x] | |
| i32 * i32 | [x] | |
| f32 * f32 | [ ] | |
| f64 * f64 | [ ] | |
| Integer * Literal | [x] | |

### 4.4 Division (/)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u32 / u32 | [x] | |
| i32 / i32 | [x] | |
| f32 / f32 | [ ] | |
| f64 / f64 | [ ] | |
| Integer / Literal | [x] | |
| Division by zero **(ERROR)** | [ ] | |

### 4.5 Modulo (%)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u32 % u32 | [x] | |
| i32 % i32 | [x] | |
| Integer % Literal | [x] | |
| Modulo by zero **(ERROR)** | [ ] | |

---

## 5. Bitwise Operators

### 5.1 AND (&)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 & u8 | [ ] | |
| u16 & u16 | [ ] | |
| u32 & u32 | [x] | |
| u64 & u64 | [ ] | |
| i8 & i8 | [ ] | |
| i16 & i16 | [ ] | |
| i32 & i32 | [ ] | |
| i64 & i64 | [ ] | |
| Integer & Literal | [x] | |
| With hex literal | [ ] | |
| With binary literal | [ ] | |

### 5.2 OR (|)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 \| u8 | [ ] | |
| u16 \| u16 | [ ] | |
| u32 \| u32 | [x] | |
| u64 \| u64 | [ ] | |
| Integer \| Literal | [x] | |
| With hex literal | [ ] | |
| With binary literal | [ ] | |

### 5.3 XOR (^)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 ^ u8 | [ ] | |
| u16 ^ u16 | [ ] | |
| u32 ^ u32 | [x] | |
| u64 ^ u64 | [ ] | |
| Integer ^ Literal | [x] | |

### 5.4 NOT (~)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| ~u8 | [ ] | |
| ~u16 | [ ] | |
| ~u32 | [x] | |
| ~u64 | [ ] | |
| ~i8 | [ ] | |
| ~i16 | [ ] | |
| ~i32 | [ ] | |
| ~i64 | [ ] | |

### 5.5 Left Shift (<<)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 << amount | [ ] | |
| u16 << amount | [ ] | |
| u32 << amount | [x] | |
| u64 << amount | [ ] | |
| Shift by literal | [x] | |
| Shift by variable | [ ] | |
| Shift beyond width **(ERROR)** | [ ] | |

### 5.6 Right Shift (>>)

| Operand Types | Status | Test File |
|---------------|--------|-----------|
| u8 >> amount | [ ] | |
| u16 >> amount | [ ] | |
| u32 >> amount | [x] | |
| u64 >> amount | [ ] | |
| i32 >> amount (arithmetic) | [ ] | |
| Shift by literal | [x] | |
| Shift by variable | [ ] | |

---

## 6. Logical Operators

### 6.1 AND (&&)

| Context | Status | Test File |
|---------|--------|-----------|
| In if condition | [x] | |
| In while condition | [x] | |
| In for condition | [x] | |
| In do-while condition | [x] | `do-while/do-while-logical.cnx` |
| In ternary condition | [x] | `ternary/ternary-logical.cnx` |
| As standalone expression | [ ] | |
| Short-circuit evaluation | [ ] | |
| With bool operands | [x] | |
| With comparison operands | [x] | |
| Chained (a && b && c) | [ ] | |

### 6.2 OR (||)

| Context | Status | Test File |
|---------|--------|-----------|
| In if condition | [x] | |
| In while condition | [x] | |
| In for condition | [x] | |
| In do-while condition | [x] | |
| In ternary condition | [x] | |
| As standalone expression | [ ] | |
| Short-circuit evaluation | [ ] | |
| In switch case labels | [x] | `switch/switch-multiple-cases.cnx` |
| Chained (a \|\| b \|\| c) | [ ] | |

### 6.3 NOT (!)

| Context | Status | Test File |
|---------|--------|-----------|
| !bool_var | [x] | |
| !comparison | [x] | |
| In if condition | [x] | |
| In while condition | [x] | |
| In ternary condition | [ ] | |
| Double negation (!!) | [ ] | |

---

## 7. Control Flow

### 7.1 if Statement

| Variant | Status | Test File |
|---------|--------|-----------|
| Simple if | [x] | `assignment/comparison-if.cnx` |
| if with block | [x] | |
| if-else | [x] | |
| if-else if-else | [x] | |
| Nested if | [ ] | |
| if inside loop | [x] | |
| if inside scope | [x] | |
| if inside critical | [x] | `critical/critical-with-conditional.cnx` |
| Non-boolean condition **(ERROR)** | [ ] | |

### 7.2 while Loop

| Variant | Status | Test File |
|---------|--------|-----------|
| Simple while | [x] | `assignment/comparison-while.cnx` |
| While with block | [x] | |
| While with counter | [x] | |
| Nested while | [ ] | |
| While inside if | [ ] | |
| While inside scope | [ ] | |
| Non-boolean condition **(ERROR)** | [ ] | |
| Infinite while (while true) | [ ] | |

### 7.3 do-while Loop

| Variant | Status | Test File |
|---------|--------|-----------|
| Simple do-while | [x] | `do-while/do-while-basic.cnx` |
| With equality condition | [x] | `do-while/do-while-equality.cnx` |
| With logical condition | [x] | `do-while/do-while-logical.cnx` |
| With boolean variable | [x] | `do-while/do-while-boolean-var.cnx` |
| Nested do-while | [ ] | |
| do-while inside if | [ ] | |
| Non-boolean condition **(ERROR)** | [x] | `do-while/do-while-error-non-boolean.cnx` |

### 7.4 for Loop

| Variant | Status | Test File |
|---------|--------|-----------|
| Basic for | [x] | `for-loops/for-basic.cnx` |
| Array iteration | [x] | `for-loops/for-array-iteration.cnx` |
| Nested for | [x] | `for-loops/for-nested.cnx` |
| For with compound update | [ ] | |
| For with multiple init | [ ] | |
| For with empty init | [ ] | |
| For with empty condition | [ ] | |
| For with empty update | [ ] | |
| For inside if | [ ] | |
| For inside scope | [ ] | |
| Non-boolean condition **(ERROR)** | [ ] | |

### 7.5 switch Statement

| Variant | Status | Test File |
|---------|--------|-----------|
| Basic integer switch | [x] | `switch/switch-basic.cnx` |
| Enum exhaustive | [x] | `switch/switch-enum-exhaustive.cnx` |
| Multiple cases (\|\|) | [x] | `switch/switch-multiple-cases.cnx` |
| Counted default | [x] | `switch/switch-enum-default-counted.cnx` |
| Hex literal cases | [ ] | |
| Char literal cases | [ ] | |
| Nested switch | [ ] | |
| Switch inside loop | [ ] | |
| Switch inside scope | [ ] | |
| Boolean switch **(ERROR)** | [x] | `switch/switch-error-boolean.cnx` |
| Single case **(ERROR)** | [x] | `switch/switch-error-single-case.cnx` |
| Duplicate case **(ERROR)** | [x] | `switch/switch-error-duplicate-case.cnx` |
| Non-exhaustive enum **(ERROR)** | [x] | `switch/switch-error-non-exhaustive.cnx` |
| Wrong default count **(ERROR)** | [x] | `switch/switch-error-wrong-count.cnx` |

### 7.6 return Statement

| Context | Status | Test File |
|---------|--------|-----------|
| Return void | [x] | |
| Return value | [x] | |
| Return expression | [x] | |
| Return in if branch | [x] | |
| Return in else branch | [x] | |
| Return in loop | [x] | |
| Return in critical **(ERROR)** | [x] | `critical/return-error.cnx` |
| Early return | [x] | |
| Return ternary result | [x] | |

### 7.7 critical Block

| Variant | Status | Test File |
|---------|--------|-----------|
| Basic critical | [x] | `critical/basic.cnx` |
| With conditional | [x] | `critical/critical-with-conditional.cnx` |
| Multi-variable | [x] | `critical/multi-variable.cnx` |
| Nested critical | [ ] | |
| Critical in loop | [ ] | |
| Critical in if | [ ] | |
| Return inside **(ERROR)** | [x] | `critical/return-error.cnx` |

---

## 8. Ternary Operator

| Variant | Status | Test File |
|---------|--------|-----------|
| Basic ternary | [x] | `ternary/ternary-basic.cnx` |
| With equality condition | [x] | `ternary/ternary-equality.cnx` |
| With relational condition | [x] | |
| With logical condition | [x] | `ternary/ternary-logical.cnx` |
| In return statement | [x] | |
| In assignment | [x] | |
| In function argument | [ ] | |
| With function calls as values | [ ] | |
| Non-boolean condition **(ERROR)** | [x] | `ternary/ternary-error-non-boolean.cnx` |
| Nested ternary **(ERROR)** | [x] | `ternary/ternary-error-nested.cnx` |
| Missing parentheses **(ERROR)** | [x] | `ternary/ternary-error-no-parens.cnx` |

---

## 9. Struct Declaration

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic declaration | [x] | `structs/struct-declaration.cnx` |
| With primitive members | [x] | |
| With array member | [x] | `structs/struct-with-array.cnx` |
| With nested struct | [x] | `nested-structs/basic-nesting.cnx` |
| Deep nesting (3+ levels) | [x] | `nested-structs/deep-nesting.cnx` |
| Zero initialization | [x] | |
| Named field initialization | [x] | `structs/struct-initialization.cnx` |
| Member access (.) | [x] | `structs/struct-member-access.cnx` |
| Chained member access | [x] | `nested-structs/basic-nesting.cnx` |
| As function parameter | [x] | `structs/struct-function-param.cnx` |
| Nested as parameter | [x] | `nested-structs/function-params.cnx` |
| As function return | [ ] | |
| Const struct | [x] | `structs/struct-const.cnx` |
| Array of structs | [x] | `array-initializers/struct-array.cnx` |
| Array of struct member access | [x] | `static-allocation/static-struct-buffer.cnx` |
| Struct in scope | [ ] | |
| Redundant type in init **(ERROR)** | [x] | `structs/struct-redundant-type-error.cnx` |

---

## 10. Enum Declaration

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic enum | [x] | `enum/basic-enum.cnx` |
| With explicit values | [x] | |
| With auto-increment values | [x] | |
| Scoped enum | [x] | `enum/scoped-enum.cnx` |
| Enum in switch | [x] | `switch/switch-enum-exhaustive.cnx` |
| Enum comparison (same type) | [x] | |
| Enum as function parameter | [ ] | |
| Enum as function return | [ ] | |
| Cast to integer | [ ] | |
| Compare different types **(ERROR)** | [x] | `enum/enum-error-compare-types.cnx` |
| Compare with int **(ERROR)** | [x] | `enum/enum-error-compare-int.cnx` |
| Assign int **(ERROR)** | [x] | `enum/enum-error-assign-int.cnx` |
| Negative value **(ERROR)** | [x] | `enum/enum-error-negative.cnx` |

---

## 11. Bitmap Declaration

| Feature | Status | Test File |
|---------|--------|-----------|
| bitmap8 basic | [x] | `bitmap/basic-bitmap.cnx` |
| bitmap16 | [x] | `bitmap/bitmap-16.cnx` |
| bitmap24 | [ ] | |
| bitmap32 | [ ] | |
| Single-bit field | [x] | |
| Multi-bit field | [x] | |
| In register | [x] | `bitmap/bitmap-in-register.cnx` |
| As variable type | [x] | |
| As struct member | [ ] | |
| Bit overflow **(ERROR)** | [x] | `bitmap/bitmap-error-overflow.cnx` |
| Total bits mismatch **(ERROR)** | [x] | `bitmap/bitmap-error-bits.cnx` |

---

## 12. Register Declaration

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic register | [x] | `register/register-basic.cnx` |
| Multiple registers | [x] | `register/register-multiple.cnx` |
| With address offset | [x] | `register/register-offsets.cnx` |
| rw access modifier | [x] | `register/register-access-modifiers.cnx` |
| ro access modifier | [x] | |
| wo access modifier | [x] | |
| w1c access modifier | [ ] | |
| w1s access modifier | [ ] | |
| Bit indexing | [x] | `register/register-bit-indexing.cnx` |
| Bit range access | [ ] | |
| Bitfield members | [ ] | |
| Scoped register | [x] | `scope/scoped-register-basic.cnx` |
| Scoped register bit access | [x] | `scope/scoped-register-bit-access.cnx` |
| Write to ro **(ERROR)** | [x] | `register/register-write-ro-error.cnx` |
| Read from wo **(ERROR)** | [ ] | |

### 12.2 Register Bitfields (bits keyword)

**STATUS: NOT VALID C-NEXT SYNTAX** - The `bits[start..end]` syntax has been removed from the grammar. Attempting to use it will produce a parse error.

**Note:** Use **bitmap types** instead (Section 11). Bitmaps are fully implemented and provide the same functionality with better reusability. The blink example demonstrates this pattern: define a `bitmap32` type, then use it as the register member type.

| Feature | Status | Test File |
|---------|--------|-----------|
| bits[start..end] syntax **(ERROR)** | [x] | `register/register-bits-syntax-error.cnx` |

---

## 13. Scope Declaration

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic scope | [x] | `scope/this-global-test.cnx` |
| Scope with variables | [x] | |
| Scope with functions | [x] | |
| Scope with structs | [ ] | |
| Scope with enums | [x] | `enum/scoped-enum.cnx` |
| Scope with registers | [x] | `scope/scoped-register-basic.cnx` |
| this.member access | [x] | |
| this.member assignment | [x] | |
| this.member compound assign | [x] | `scope/scope-compound-assign.cnx` |
| global.member access | [x] | |
| global.member assignment | [x] | |
| global.member compound assign | [x] | `scope/global-compound-assign.cnx` |
| Cross-scope access | [x] | `scope/cross-scope-compound.cnx` |
| private visibility | [ ] | |
| public visibility | [ ] | |
| Bare identifier in scope **(ERROR)** | [x] | `scope/bare-identifier-error.cnx` |
| Bare global access **(ERROR)** | [x] | `scope/bare-global-error.cnx` |
| Nested scopes | [ ] | |

### 13.2 Scoped Types (this.Type)

| Feature | Status | Test File |
|---------|--------|-----------|
| this.Type declaration | [ ] | |
| this.Type as parameter | [ ] | |
| this.Type as return | [ ] | |
| this.Type as variable | [ ] | |

### 13.3 Qualified Types (Scope.Type)

| Feature | Status | Test File |
|---------|--------|-----------|
| Scope.Type reference | [x] | `enum/scoped-enum.cnx` |
| Scope.Type as parameter | [ ] | |
| Scope.Type as return | [ ] | |
| Scope.Enum.VALUE access | [x] | |

---

## 14. Functions

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic function | [x] | |
| With parameters | [x] | |
| With return value | [x] | |
| Void return | [x] | |
| Multiple parameters | [x] | |
| Const parameters | [x] | `const/const-parameter.cnx` |
| Array parameters | [x] | |
| Struct parameters | [x] | `structs/struct-function-param.cnx` |
| Nested struct parameters | [x] | `nested-structs/function-params.cnx` |
| main() no args | [x] | `functions/main-no-args.cnx` |
| main() with args | [x] | `functions/main-with-args.cnx` |
| main() with 2D array | [x] | `functions/main-2d-array.cnx` |
| Define before use | [x] | `forward-declarations/define-before-use-valid.cnx` |
| Nested calls | [x] | `forward-declarations/nested-calls-valid.cnx` |
| Call before define **(ERROR)** | [x] | `forward-declarations/call-before-define-error.cnx` |
| Recursive call **(ERROR)** | [x] | `forward-declarations/recursive-call-error.cnx` |
| Function in scope | [x] | |

---

## 15. Callbacks

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic callback type | [x] | `callbacks/callback-basic.cnx` |
| Callback assignment | [x] | `callbacks/callback-assign.cnx` |
| Callback as parameter | [x] | `callbacks/callback-param.cnx` |
| Callback invocation | [x] | |
| Array of callbacks | [ ] | |
| Callback as struct member | [ ] | |
| Nominal type mismatch **(ERROR)** | [x] | `callbacks/callback-error-nominal.cnx` |

---

## 16. Arrays

### 16.1 Single-dimensional

| Feature | Status | Test File |
|---------|--------|-----------|
| Declaration with size | [x] | |
| Declaration with init | [x] | `array-initializers/basic-init.cnx` |
| Inferred size | [x] | `array-initializers/size-inference.cnx` |
| Fill-all [0*] | [x] | `array-initializers/fill-all.cnx` |
| Const array | [x] | `array-initializers/const-tables.cnx` |
| Array of structs | [x] | `array-initializers/struct-array.cnx` |
| .length property | [x] | `bit-indexing/length-property.cnx` |
| Element access | [x] | |
| Element assignment | [x] | |
| In for loop | [x] | `for-loops/for-array-iteration.cnx` |
| As function parameter | [x] | |
| Out of bounds **(ERROR)** | [ ] | |

### 16.2 Multi-dimensional

| Feature | Status | Test File |
|---------|--------|-----------|
| 2D declaration | [x] | `multi-dim-arrays/basic-2d.cnx` |
| 3D declaration | [x] | `multi-dim-arrays/basic-3d.cnx` |
| Nested initialization | [x] | `multi-dim-arrays/nested-init.cnx` |
| .length per dimension | [x] | `multi-dim-arrays/length-property.cnx` |
| As struct member | [x] | `multi-dim-arrays/struct-member.cnx` |
| Compound assignment | [x] | `multi-dim-arrays/compound-assign-2d.cnx` |
| Struct member compound | [x] | `multi-dim-arrays/struct-member-compound.cnx` |
| Bounds check **(ERROR)** | [x] | `multi-dim-arrays/bounds-error.cnx` |

---

## 17. Bit Indexing

| Feature | Status | Test File |
|---------|--------|-----------|
| Single bit read | [x] | `bit-indexing/bit-single-read.cnx` |
| Single bit write | [x] | `bit-indexing/bit-single-write.cnx` |
| Bit range read | [x] | `bit-indexing/bit-range-read.cnx` |
| Bit range write | [x] | `bit-indexing/bit-range-write.cnx` |
| .length property | [x] | `bit-indexing/length-property.cnx` |
| On u8 | [ ] | |
| On u16 | [ ] | |
| On u32 | [x] | |
| On u64 | [ ] | |
| On register fields | [x] | `register/register-bit-indexing.cnx` |
| On wo register (optimized) | [x] | |
| For narrowing cast | [x] | `casting/bit-index-narrowing.cnx` |
| For sign cast | [x] | `casting/bit-index-sign.cnx` |
| Variable index | [ ] | |
| Expression index | [ ] | |
| Out of bounds index **(ERROR)** | [ ] | |

---

## 18. Strings

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic declaration | [x] | `string/string-basic.cnx` |
| Empty string | [x] | `string/string-empty.cnx` |
| .length property | [x] | `string/string-length.cnx` |
| .capacity property | [x] | `string/string-capacity.cnx` |
| .size property | [x] | `string/string-size.cnx` |
| Const inference | [x] | `string/string-const-inference.cnx` |
| Compare = | [x] | `string/string-compare-eq.cnx` |
| Compare != | [x] | `string/string-compare-neq.cnx` |
| Compare with literal | [x] | `string/string-compare-literal.cnx` |
| Concatenation | [x] | `string/string-concat-basic.cnx` |
| Concat with literal | [x] | `string/string-concat-literal.cnx` |
| Substring | [x] | `string/string-substring.cnx` |
| Substring with offset | [x] | `string/string-substring-offset.cnx` |
| Function parameter | [x] | `string/string-function-param.cnx` |
| As struct member | [ ] | |
| Array of strings | [ ] | |
| Overflow **(ERROR)** | [x] | `string/string-error-overflow.cnx` |
| Const no init **(ERROR)** | [x] | `string/string-error-const-no-init.cnx` |
| Non-const unsized **(ERROR)** | [x] | `string/string-error-nonconst-unsized.cnx` |
| Concat overflow **(ERROR)** | [x] | `string/string-error-concat-overflow.cnx` |
| Substring bounds **(ERROR)** | [x] | `string/string-error-substring-bounds.cnx` |
| Substring dest size **(ERROR)** | [x] | `string/string-error-substring-dest.cnx` |

---

## 19. Const Modifier

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable | [x] | `const/const-variable.cnx` |
| Local variable | [x] | |
| Function parameter | [x] | `const/const-parameter.cnx` |
| Array element type | [x] | `array-initializers/const-tables.cnx` |
| Struct member | [ ] | |
| String (inferred) | [x] | `string/string-const-inference.cnx` |
| Assign to const **(ERROR)** | [x] | `const/const-assign-error.cnx` |
| Compound assign const **(ERROR)** | [x] | `const/const-compound-assign-error.cnx` |
| Assign const param **(ERROR)** | [x] | `const/const-param-assign-error.cnx` |

---

## 20. Atomic Modifier

| Context | Status | Test File |
|---------|--------|-----------|
| Basic atomic | [x] | `atomic/basic.cnx` |
| All integer types | [x] | `atomic/atomic-all-types.cnx` |
| Compound operations | [x] | `atomic/atomic-compound-ops.cnx` |
| PRIMASK fallback | [x] | `atomic/primask-fallback.cnx` |
| With clamp | [ ] | |
| With wrap | [ ] | |
| In scope | [ ] | |
| As struct member | [ ] | |
| In critical section | [ ] | |

---

## 21. Overflow Modifiers (clamp/wrap)

### 21.1 clamp (Saturating)

| Context | Status | Test File |
|---------|--------|-----------|
| u8 clamp | [ ] | |
| u16 clamp | [ ] | |
| u32 clamp | [x] | `primitives/clamp-declaration.cnx` |
| u64 clamp | [ ] | |
| i8 clamp | [ ] | |
| i16 clamp | [ ] | |
| i32 clamp | [x] | `primitives/signed-overflow.cnx` |
| i64 clamp | [ ] | |
| Compound add | [x] | `primitives/clamp-compound-add.cnx` |
| Compound sub | [ ] | |
| Compound mul | [ ] | |
| With atomic | [ ] | |
| Overflow to max | [x] | |
| Underflow to min | [ ] | |

### 21.2 wrap (Wrapping)

| Context | Status | Test File |
|---------|--------|-----------|
| u8 wrap | [ ] | |
| u16 wrap | [ ] | |
| u32 wrap | [x] | `primitives/wrap-declaration.cnx` |
| u64 wrap | [ ] | |
| i8 wrap | [ ] | |
| i16 wrap | [ ] | |
| i32 wrap | [x] | `primitives/signed-overflow.cnx` |
| i64 wrap | [ ] | |
| Compound add | [x] | `primitives/wrap-compound-add.cnx` |
| Compound sub | [ ] | |
| Compound mul | [ ] | |
| With atomic | [ ] | |
| Wrap around | [x] | |

### 21.3 Mixed Overflow

| Feature | Status | Test File |
|---------|--------|-----------|
| Mixed in expression | [x] | `primitives/mixed-overflow.cnx` |
| clamp + wrap interaction | [x] | |

---

## 22. Type Casting

| Conversion | Status | Test File |
|------------|--------|-----------|
| Widening unsigned (u8 -> u16) | [x] | `casting/widening-unsigned.cnx` |
| Widening signed (i8 -> i16) | [x] | `casting/widening-signed.cnx` |
| Explicit cast (u32) | [x] | |
| Literal in range | [x] | `casting/literal-valid.cnx` |
| Enum to int cast | [ ] | |
| Narrowing assign **(ERROR)** | [x] | `casting/narrowing-assign-error.cnx` |
| Narrowing cast **(ERROR)** | [x] | `casting/narrowing-cast-error.cnx` |
| Sign assign **(ERROR)** | [x] | `casting/sign-assign-error.cnx` |
| Sign cast **(ERROR)** | [x] | `casting/sign-cast-error.cnx` |
| Literal overflow **(ERROR)** | [x] | `casting/literal-overflow-error.cnx` |
| Literal neg to unsigned **(ERROR)** | [x] | `casting/literal-negative-unsigned-error.cnx` |
| Literal hex overflow **(ERROR)** | [x] | `casting/literal-hex-overflow-error.cnx` |
| Literal binary overflow **(ERROR)** | [x] | `casting/literal-binary-overflow-error.cnx` |
| Bit index narrowing | [x] | `casting/bit-index-narrowing.cnx` |
| Bit index sign | [x] | `casting/bit-index-sign.cnx` |

---

## 23. sizeof Operator

| Context | Status | Test File |
|---------|--------|-----------|
| Primitive type | [x] | `sizeof/basic-type.cnx` |
| Variable | [x] | `sizeof/basic-variable.cnx` |
| Struct type | [x] | `sizeof/struct-type.cnx` |
| Local array | [ ] | |
| Struct member | [ ] | |
| In expression | [ ] | |
| In array size | [ ] | |
| Array parameter **(ERROR)** | [x] | `sizeof/array-param-error.cnx` |
| Side effects **(ERROR)** | [x] | `sizeof/side-effects-error.cnx` |

---

## 24. Preprocessor

| Directive | Status | Test File |
|-----------|--------|-----------|
| #include <system> | [x] | `c-interop/include-passthrough.cnx` |
| #include "local" | [x] | |
| #define FLAG (valid) | [x] | `preprocessor/flag-define-valid.cnx` |
| #ifdef / #endif | [x] | `preprocessor/conditional-compilation.cnx` |
| #ifndef / #else / #endif | [x] | |
| #pragma target | [x] | `platformio-detect/auto-detect.cnx` |
| Nested #ifdef | [ ] | |
| #define VALUE **(ERROR)** | [x] | `preprocessor/value-define-error.cnx` |
| #define FUNC() **(ERROR)** | [x] | `preprocessor/function-macro-error.cnx` |

---

## 25. Comments

| Type | Status | Test File |
|------|--------|-----------|
| Line comment // | [x] | `comments/basic-comments.cnx` |
| Block comment /* */ | [x] | |
| Doc comment /// | [x] | `comments/doc-comments.cnx` |
| URI exception | [x] | `comments/uri-exception.cnx` |
| Multi-line block | [x] | |
| Comment in expression | [ ] | |
| MISRA 3.1 nested **(ERROR)** | [x] | `comments/misra-3-1-nested-block.cnx` |
| MISRA 3.2 backslash **(ERROR)** | [x] | `comments/misra-3-2-backslash.cnx` |

---

## 26. Initialization

| Context | Status | Test File |
|---------|--------|-----------|
| Zero-init global | [x] | `initialization/global-zero-init.cnx` |
| Zero-init array | [x] | `initialization/array-zero-init.cnx` |
| Zero-init struct | [x] | `initialization/struct-zero-init.cnx` |
| Counter from zero | [x] | `initialization/counter-from-zero.cnx` |
| Init then use | [x] | `initialization/init-then-use.cnx` |
| If-else branches | [x] | `initialization/if-else-branches.cnx` |
| Namespace init | [x] | `initialization/namespace-init.cnx` |
| Loop init | [ ] | |
| Switch branch init | [ ] | |
| Use before init **(ERROR)** | [x] | `initialization/use-before-init.cnx` |
| Partial branch init **(ERROR)** | [ ] | |

---

## 27. References (Pass-by-reference)

| Feature | Status | Test File |
|---------|--------|-----------|
| Pass by reference | [x] | `references/pass-by-reference.cnx` |
| Output parameter | [x] | `references/output-parameter.cnx` |
| Struct pass by ref | [x] | `references/struct-pass-by-ref.cnx` |
| Swap function | [x] | `references/swap-function.cnx` |
| Compound via ref | [x] | `references/compound-via-ref.cnx` |
| Array pass by ref | [ ] | |
| Multiple output params | [ ] | |
| Ref in loop | [ ] | |

---

## 28. NULL Interop

| Feature | Status | Test File |
|---------|--------|-----------|
| fgets != NULL | [x] | `null-check/valid-fgets-check.cnx` |
| fgets = NULL | [x] | `null-check/valid-null-eq-check.cnx` |
| fgets else branch | [x] | `null-check/valid-fgets-else.cnx` |
| fputs check | [x] | `null-check/valid-fputs-check.cnx` |
| fgetc check | [x] | `null-check/valid-fgetc-check.cnx` |
| != NULL variant | [x] | `null-check/null-neq-check.cnx` |
| NULL in while | [ ] | |
| NULL in ternary | [ ] | |
| Missing check **(ERROR)** | [x] | `null-check/missing-null-check.cnx` |
| Invalid usage **(ERROR)** | [x] | `null-check/invalid-null-usage.cnx` |
| fopen forbidden **(ERROR)** | [x] | `null-check/forbidden-fopen.cnx` |

---

## 29. Static Allocation

| Feature | Status | Test File |
|---------|--------|-----------|
| Static array | [x] | `static-allocation/static-array.cnx` |
| Static counter | [x] | `static-allocation/static-counter.cnx` |
| Static struct buffer | [x] | `static-allocation/static-struct-buffer.cnx` |
| Static string buffer | [ ] | |
| malloc **(ERROR)** | [x] | `static-allocation/malloc-error.cnx` |
| calloc **(ERROR)** | [x] | `static-allocation/calloc-error.cnx` |
| realloc **(ERROR)** | [x] | `static-allocation/realloc-error.cnx` |
| free **(ERROR)** | [x] | `static-allocation/free-error.cnx` |

---

## 30. C Interoperability

| Feature | Status | Test File |
|---------|--------|-----------|
| C types compatibility | [x] | `c-interop/c-types-compat.cnx` |
| Generated C readable | [x] | `c-interop/generated-c-readable.cnx` |
| Include passthrough | [x] | `c-interop/include-passthrough.cnx` |
| Call C function | [ ] | |
| Use C typedef | [ ] | |
| Use C macro constant | [ ] | |
| Volatile qualifier | [ ] | |

---

## 30a. Volatile Modifier

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable | [ ] | |
| Local variable | [ ] | |
| Struct member | [ ] | |
| Register field (implied) | [ ] | |
| With const | [ ] | |
| With atomic | [ ] | |

---

## 31. ISR Type

| Feature | Status | Test File |
|---------|--------|-----------|
| Basic ISR | [x] | `isr/isr-basic.cnx` |
| ISR assignment | [x] | `isr/isr-assignment.cnx` |
| ISR array | [x] | `isr/isr-array.cnx` |
| ISR as parameter | [ ] | |
| ISR in struct | [ ] | |
| ISR invocation | [ ] | |

---

## 32. Literals

### 32.1 Integer Literals

| Format | Context | Status | Test File |
|--------|---------|--------|-----------|
| Decimal | Variable init | [x] | |
| Decimal | Array element | [x] | |
| Decimal | Function arg | [x] | |
| Decimal | Comparison | [x] | |
| Hex (0x) | Variable init | [x] | |
| Hex (0x) | Bitwise op | [x] | |
| Hex (0x) | Register address | [x] | |
| Binary (0b) | Variable init | [x] | |
| Binary (0b) | Bit mask | [ ] | |
| With u8 suffix | [ ] | |
| With u16 suffix | [ ] | |
| With u32 suffix | [ ] | |
| With i8 suffix | [ ] | |
| With i16 suffix | [ ] | |
| With i32 suffix | [ ] | |

### 32.2 Float Literals

| Format | Context | Status | Test File |
|--------|---------|--------|-----------|
| Decimal (3.14) | Variable init | [ ] | |
| Scientific (1e-5) | Variable init | [ ] | |
| With f32 suffix | [ ] | |
| With f64 suffix | [ ] | |

### 32.3 String Literals

| Context | Status | Test File |
|---------|--------|-----------|
| Variable init | [x] | `string/string-basic.cnx` |
| Function argument | [x] | |
| Comparison | [x] | `string/string-compare-literal.cnx` |
| Concatenation | [x] | `string/string-concat-literal.cnx` |
| Empty string "" | [x] | `string/string-empty.cnx` |
| Escape sequences | [ ] | |

### 32.4 Character Literals

| Context | Status | Test File |
|---------|--------|-----------|
| Variable init | [ ] | |
| Array element | [ ] | |
| Comparison | [ ] | |
| In switch case | [ ] | |
| Escape sequences | [ ] | |

### 32.5 Boolean Literals

| Literal | Context | Status | Test File |
|---------|---------|--------|-----------|
| true | Variable init | [x] | |
| true | Bit assignment | [x] | `bit-indexing/bit-single-write.cnx` |
| true | Comparison | [x] | |
| false | Variable init | [x] | |
| false | Bit assignment | [x] | |
| false | Comparison | [x] | |

---

## 33. Generic Types

| Feature | Status | Test File |
|---------|--------|-----------|
| Type<Arg> declaration | [ ] | |
| Type<Arg1, Arg2> | [ ] | |
| Generic function | [ ] | |
| Generic struct | [ ] | |
| Numeric type parameter | [ ] | |

*Note: Generic types are defined in grammar but implementation status unclear.*

---

## 34. Expression Contexts

### 34.1 Nested/Complex Expressions

| Context | Status | Test File |
|---------|--------|-----------|
| Nested function calls | [x] | `forward-declarations/nested-calls-valid.cnx` |
| Chained member access | [x] | `nested-structs/basic-nesting.cnx` |
| Array in array | [x] | `multi-dim-arrays/nested-init.cnx` |
| Arithmetic in comparison | [x] | |
| Comparison in logical | [x] | |
| Function call in expression | [x] | |
| Ternary in function arg | [ ] | |
| Ternary in array index | [ ] | |
| Ternary in return | [x] | |
| Multiple operators same precedence | [ ] | |
| Parenthesized sub-expressions | [x] | |

### 34.2 Statement Nesting

| Context | Status | Test File |
|---------|--------|-----------|
| if inside if | [ ] | |
| if inside while | [x] | |
| if inside for | [x] | |
| while inside if | [ ] | |
| while inside while | [ ] | |
| for inside for | [x] | `for-loops/for-nested.cnx` |
| for inside if | [ ] | |
| switch inside if | [ ] | |
| switch inside loop | [ ] | |
| critical inside if | [ ] | |
| critical inside loop | [ ] | |
| 3+ levels of nesting | [ ] | |

---

## Priority Summary

### High Priority (Core Language Gaps)

- [ ] Float types (f32, f64) - all contexts
- [ ] Character literals
- [ ] Type-suffixed literals (42u8, etc.)
- [ ] Boolean as function parameter/return
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

*Last updated: 2026-01-09*

**Current Test Count: 209 passing tests**

| Category | Estimated Coverage |
|----------|-------------------|
| Primitive Types | ~60% (gaps in f32/f64, u64/i64 operations) |
| Assignment Operators | ~65% (array + struct compound ops now tested) |
| Comparison Operators | ~50% (float comparisons missing) |
| Arithmetic Operators | ~30% (float ops missing) |
| Bitwise Operators | ~20% (only u32 well tested) |
| Logical Operators | ~70% (basic contexts covered) |
| Control Flow | ~80% (good coverage, some nesting gaps) |
| Type Declarations | ~75% (structs/enums good, bitmaps sparse) |
| Functions | ~85% (solid basic coverage) |
| Arrays | ~80% (good, some edge cases) |
| Strings | ~90% (excellent coverage) |
| Modifiers | ~60% (atomic good, volatile missing) |
| Register Bitfields | ~10% (sparse) |
| Generic Types | ~0% (not tested) |
| Statement Nesting | ~30% (basic only) |

**Overall Estimated Coverage: ~55%**

### Coverage by Test File Count

| Test Category | Files | Error Tests |
|--------------|-------|-------------|
| string | 21 | 6 |
| casting | 13 | 8 |
| scope | 11 | 5 |
| switch | 9 | 5 |
| null-check | 9 | 5 |
| initialization | 8 | 3 |
| multi-dim-arrays | 11 | 1 |
| primitives | 8 | 0 |
| static-allocation | 7 | 4 |
| structs | 8 | 1 |
| nested-structs | 5 | 0 |
| enum | 6 | 4 |
| register | 6 | 1 |
| ternary | 6 | 3 |
| Other categories | ~93 | ~21 |
| **TOTAL** | **209** | **~62** |
