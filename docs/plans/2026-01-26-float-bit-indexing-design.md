# Float Bit Indexing Design

**Date**: 2026-01-26
**Status**: Approved

## Overview

Enable bit-level read/write operations on `f32` and `f64` types using shadow integer variables and `memcpy` for type-safe bit manipulation.

## Problem

The current transpiler generates invalid C when bit indexing is used on floats:

```cnx
f32 result <- 0.0;
result[0,8] <- b0;  // Invalid: generates bitwise ops directly on float
```

Bitwise operators (`&`, `|`, `~`, `<<`) are undefined on `float` in C.

## Solution

Use a shadow integer variable with `memcpy` to safely manipulate float bits:

```c
uint32_t __bits_result; memcpy(&__bits_result, &result, sizeof(result));
__bits_result = (__bits_result & ~(0xFFU << 0)) | ((b0 & 0xFFU) << 0);
memcpy(&result, &__bits_result, sizeof(result));
```

## Design Decisions

1. **Per-statement memcpy** - Each bit assignment is self-contained. Compiler optimizes redundant memcpys.

2. **Always memcpy first** - Even for zero-initialized floats, memcpy from float to shadow for consistency.

3. **Support both read and write** - Symmetric API for serialization use cases.

4. **f64 uses uint64_t** - 8-byte shadow with `ULL` suffix masks.

5. **Track and reuse shadow variables** - Declare on first use, reuse thereafter for cleaner output.

6. **Auto-include string.h** - Add `needsStringH` effect flag.

## Type Mapping

| Float Type | Shadow Type | Size |
| ---------- | ----------- | ---- |
| `f32`      | `uint32_t`  | 4    |
| `f64`      | `uint64_t`  | 8    |

## Generated Code Patterns

### Write Operation

```cnx
f32 value <- 0.0;
value[0, 8] <- b0;
```

```c
float value = 0.0f;
uint32_t __bits_value; memcpy(&__bits_value, &value, sizeof(value));
__bits_value = (__bits_value & ~(0xFFU << 0)) | ((b0 & 0xFFU) << 0);
memcpy(&value, &__bits_value, sizeof(value));
```

### Read Operation

```cnx
u8 x <- value[8, 8];
```

```c
uint32_t __bits_value; memcpy(&__bits_value, &value, sizeof(value));
uint8_t x = (__bits_value >> 8) & 0xFFU;
```

### Consecutive Assignments (reusing shadow)

```cnx
result[0,8] <- b0;
result[8,8] <- b1;
```

```c
uint32_t __bits_result; memcpy(&__bits_result, &result, sizeof(result));
__bits_result = (__bits_result & ~(0xFFU << 0)) | ((b0 & 0xFFU) << 0);
memcpy(&result, &__bits_result, sizeof(result));
memcpy(&__bits_result, &result, sizeof(result));  // reuse, no redeclaration
__bits_result = (__bits_result & ~(0xFFU << 8)) | ((b1 & 0xFFU) << 8);
memcpy(&result, &__bits_result, sizeof(result));
```

## Implementation

### Files to Modify

1. **`src/codegen/CodeGenerator.ts`**
   - Add `f32`/`f64` to bit indexing type check (~line 7897)
   - Generate shadow variable + memcpy pattern
   - Track declared shadow variables in context
   - Add `needsStringH` effect flag

2. **`src/codegen/generators/expressions/AccessExprGenerator.ts`**
   - Handle float bit indexing reads

3. **`src/codegen/generators/TIncludeHeader.ts`**
   - Add `"string_h"` to union type

### Shadow Variable Tracking

Add to CodeGenerator context:

```typescript
declaredFloatBitShadows: Set<string>;
```

Reset at start of each function. On first use of `__bits_X`, emit declaration. On subsequent uses, just reference.

## Testing

New test file: `tests/floats/float-bit-indexing.test.cnx`

- Write bytes to f32, verify IEEE-754 value
- Read bytes from f32
- f64 bit indexing
- Mixed float/integer bit ops in same function
