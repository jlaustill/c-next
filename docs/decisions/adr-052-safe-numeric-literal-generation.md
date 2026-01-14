# ADR-052: Safe Numeric Literal Generation

## Status

**Accepted**

## Related

- GitHub Issue: [#111 - Bug: Negative hex literals may generate incorrect C due to unsigned type interpretation](https://github.com/jlaustill/c-next/issues/111)
- Discovered during: [#107 - Support negative literals in switch case labels](https://github.com/jlaustill/c-next/issues/107)

## Context

When C-Next generates C code containing numeric literals, certain edge cases produce technically valid but semantically incorrect C code due to how C interprets literal types.

### The Problem

**C-Next source:**

```cnx
switch (val) {
    case -0x80000000 { result <- 1; }  // Intended: -2147483648 (INT32_MIN)
}
```

**Generated C:**

```c
case -0x80000000: { result = 1; break; }
```

**Expected behavior:** Case matches value `-2147483648`

**Actual behavior on 32-bit int systems:** Case matches value `2147483648` (positive!)

### Why This Happens

In C, the type of an integer literal is determined by its value and format:

| Literal      | Value    | Type (32-bit int)        |
| ------------ | -------- | ------------------------ |
| `2147483647` | 2^31 - 1 | `int` (signed)           |
| `2147483648` | 2^31     | `long` or `unsigned int` |
| `0x7FFFFFFF` | 2^31 - 1 | `int` (signed)           |
| `0x80000000` | 2^31     | `unsigned int`           |

The key insight: **Hex literals that exceed signed int max are typed as unsigned**.

When you write `-0x80000000`:

1. C first evaluates `0x80000000` → type is `unsigned int`, value is `2147483648`
2. C applies unary minus to the unsigned value
3. Unsigned arithmetic: `-(2147483648u)` wraps to `2147483648u`
4. The case label has value `2147483648`, not `-2147483648`

### C Standard References

From [C11 §6.4.4.1](https://en.cppreference.com/w/c/language/integer_constant):

> The type of an integer constant is the first of the corresponding list in which its value can be represented.

For **unsuffixed hexadecimal** literals, the type sequence is:

1. `int`
2. `unsigned int`
3. `long int`
4. `unsigned long int`
5. `long long int`
6. `unsigned long long int`

Since `0x80000000` (2147483648) exceeds `INT_MAX` (2147483647) on 32-bit int systems, it becomes `unsigned int`.

### Affected Scenarios

This issue affects any context where numeric literals are generated:

1. **Switch case labels** (discovered in #107)
2. **Variable initialization** (`i32 x <- -0x80000000;`)
3. **Constant expressions** (`const i32 MIN <- -0x80000000;`)
4. **Array sizes and indices**
5. **Arithmetic expressions**

### Platform Variance

| Platform       | `sizeof(int)` | Affected Range               |
| -------------- | ------------- | ---------------------------- |
| Most 32-bit    | 4             | `0x80000000` to `0xFFFFFFFF` |
| Some 16-bit    | 2             | `0x8000` to `0xFFFF`         |
| 64-bit (LP64)  | 4             | Same as 32-bit               |
| 64-bit (ILP64) | 8             | Much larger values           |

### The Decimal Edge Case

Converting to decimal does **not** fully solve the problem. In C, there is no such thing as a negative integer literal — `-2147483648` is the unary minus operator applied to the positive literal `2147483648`.

**The issue:** On 32-bit int systems, `2147483648` exceeds `INT_MAX` (2147483647), so the compiler promotes it to a wider type (`long int` or `long long int`). This means `-2147483648` may not have type `int` as expected.

**Why decimal is still safer than hex:**

The type sequence for **decimal** literals is: `int` → `long int` → `long long int` (no unsigned types)

The type sequence for **hex** literals is: `int` → `unsigned int` → `long int` → `unsigned long int` → ...

Since decimal never promotes to unsigned, the value remains correct even if the type is wider than expected. With hex, promotion to `unsigned int` causes the unary minus to wrap incorrectly.

**The standard library solution:**

This is why `<limits.h>` defines `INT_MIN` as:

```c
#define INT_MIN (-2147483647 - 1)  // NOT -2147483648
```

Both `2147483647` and `1` fit in `int`, so the expression has type `int` and value `-2147483648`.

**Implication for C-Next:**

For boundary values (type MIN values), the safest generated C is the `(-MAX - 1)` pattern:

| C-Next Value                | Generated C                    |
| --------------------------- | ------------------------------ |
| `-0x80000000` (i32)         | `(-2147483647 - 1)`            |
| `-0x8000000000000000` (i64) | `(-9223372036854775807LL - 1)` |
| `-0x8000` (i16)             | `(-32767 - 1)`                 |
| Other negative values       | `-decimal_value` (safe)        |

**References:**

- [INT_MIN - Hard to C](http://hardtoc.com/2009/07/16/int-min.html)
- [Integer constant - cppreference.com](https://en.cppreference.com/w/c/language/integer_constant.html)

---

## Research: How Other Transpilers Handle This

### TypeScript to JavaScript

Not directly applicable (JS has no integer types).

### Haxe to C++

Haxe [emits explicit casts](https://haxe.org/manual/target-cpp-getting-started.html) for type safety:

```cpp
(int)(-2147483648)
```

### Nim to C

Nim [uses suffixes](https://nim-lang.org/docs/manual.html#lexical-analysis-numeric-literals) to ensure correct types:

```c
-2147483648LL  // Forces long long
```

### Zig

Zig's comptime evaluation [catches these issues at compile time](https://ziglang.org/documentation/master/#comptime) before generating C.

### Rust (via FFI)

Rust [explicitly types all literals](https://doc.rust-lang.org/reference/tokens.html#integer-literals) in generated code:

```c
(int32_t)(-0x80000000)
```

---

## Proposed Solutions

### Option A: Convert Negative Hex to Decimal

**Approach:** When generating a negative hex literal, emit the decimal equivalent instead.

**C-Next input:**

```cnx
case -0x80000000 { }
case -0xFF { }
```

**Generated C:**

```c
case -2147483648: { break; }
case -255: { break; }
```

**Pros:**

- Simplest implementation
- Unambiguous semantics
- Works on all platforms
- No type suffix complexity

**Cons:**

- Loses hex formatting (less readable for bit patterns)
- Developer wrote hex intentionally, may expect hex in output

### Option B: Add Type Suffix

**Approach:** Append appropriate suffix to force signed interpretation.

**C-Next input:**

```cnx
case -0x80000000 { }
```

**Generated C:**

```c
case -0x80000000LL: { break; }  // LL forces long long (signed)
```

**Suffix mapping:**
| C-Next Type | C Suffix |
|-------------|----------|
| i8, i16, i32 | None or `L` |
| i64 | `LL` |
| u8, u16, u32 | `U` or `UL` |
| u64 | `ULL` |

**Pros:**

- Preserves hex formatting
- Explicit type intent

**Cons:**

- Complex logic to determine correct suffix
- `L` vs `LL` varies by platform
- Still platform-dependent (`L` is 32-bit on Windows, 64-bit on Linux)

### Option C: Emit Explicit Cast

**Approach:** Wrap the literal in an explicit cast to the target type.

**C-Next input:**

```cnx
i32 val <- -0x80000000;
case -0x80000000 { }
```

**Generated C:**

```c
int32_t val = (int32_t)(-0x80000000);
case (int32_t)(-0x80000000): { break; }
```

**Pros:**

- Most explicit about intent
- Uses stdint types for portability

**Cons:**

- **Does not fix the problem** - The cast is applied _after_ the unsigned interpretation has already occurred:
  1. `0x80000000` is evaluated as `unsigned int` (2147483648)
  2. Unary `-` is applied: `-(2147483648u)` wraps to `2147483648u`
  3. Cast to `int32_t`: converts `2147483648u` → implementation-defined behavior
- The damage happens before the cast can help
- Verbose output
- May generate warnings on some compilers

### Option D: Convert Problematic Hex to Decimal

**Approach:** For non-boundary problematic hex values, convert to decimal.

**Logic:**

1. If hex value fits in target signed type without ambiguity → preserve hex
2. If hex value would be interpreted as unsigned → convert to decimal

**C-Next input:**

```cnx
case -0x7F { }    // Safe: 127 fits in signed int
case -0x1000 { }  // Unsafe hex, not a boundary value
```

**Generated C:**

```c
case -0x7F: { break; }   // Preserved (safe)
case -4096: { break; }   // Converted to decimal (safe)
```

**Pros:**

- Preserves formatting when safe
- Correct semantics always
- Simple implementation for non-boundary values

**Cons:**

- Loses hex formatting for problematic values
- Silent transformation (user may not realize)

### Option E: Require Explicit MIN/MAX Constants

**Approach:** For boundary values (TYPE_MIN and TYPE_MAX), emit a compiler error requiring explicit named constants.

**C-Next input:**

```cnx
case -0x80000000 { }  // ❌ Error
case i32_MIN { }      // ✅ Valid
case 0x7FFFFFFF { }   // ❌ Error (when used as i32)
case i32_MAX { }      // ✅ Valid
```

**Compiler errors:**

```
error: Literal -0x80000000 equals i32 minimum value.
       Use 'i32_MIN' for portable, unambiguous code.

error: Literal 0x7FFFFFFF equals i32 maximum value.
       Use 'i32_MAX' for portable, unambiguous code.
```

**Generated C (for valid code):**

```c
#include <stdint.h>
case INT32_MIN: { break; }
case INT32_MAX: { break; }
```

**Constant mapping:**

| C-Next Constant | C Output (`<stdint.h>`) |
| --------------- | ----------------------- |
| `i8_MIN`        | `INT8_MIN`              |
| `i8_MAX`        | `INT8_MAX`              |
| `i16_MIN`       | `INT16_MIN`             |
| `i16_MAX`       | `INT16_MAX`             |
| `i32_MIN`       | `INT32_MIN`             |
| `i32_MAX`       | `INT32_MAX`             |
| `i64_MIN`       | `INT64_MIN`             |
| `i64_MAX`       | `INT64_MAX`             |
| `u8_MAX`        | `UINT8_MAX`             |
| `u16_MAX`       | `UINT16_MAX`            |
| `u32_MAX`       | `UINT32_MAX`            |
| `u64_MAX`       | `UINT64_MAX`            |

**Pros:**

- Educational: teaches users about the boundary trap
- Forces explicit intent: if you mean MIN, say MIN
- Portable by default: `<stdint.h>` handles all platforms
- More readable code: `i32_MIN` clearer than `-2147483648`
- No silent transformations for critical values

**Cons:**

- Breaking change if existing code uses literal boundary values
- Requires new language constants

---

## Recommendation

**Combined approach: Option E (boundaries) + Option D (other values)**

This provides two layers of safety:

| Scenario                       | Behavior                                         |
| ------------------------------ | ------------------------------------------------ |
| Literal equals `TYPE_MIN`      | **Compiler error** — require `type_MIN` constant |
| Literal equals `TYPE_MAX`      | **Compiler error** — require `type_MAX` constant |
| Problematic hex (not boundary) | **Silent conversion** to decimal                 |
| Safe hex values                | **Preserved** as-is                              |

**Rationale:**

1. **Boundary values are special** — they're the most dangerous edge cases and deserve explicit handling
2. **Educational errors** — help users understand the C type system pitfalls
3. **Non-boundary values** — silently fix without burdening the user
4. **Portable output** — uses `<stdint.h>` constants that work everywhere

### Implementation Sketch

```typescript
// Boundary values for each signed type
const SIGNED_BOUNDS: Record<string, { min: bigint; max: bigint }> = {
  i8: { min: -128n, max: 127n },
  i16: { min: -32768n, max: 32767n },
  i32: { min: -2147483648n, max: 2147483647n },
  i64: { min: -9223372036854775808n, max: 9223372036854775807n },
};

// Boundary values for unsigned types (only MAX, MIN is always 0)
const UNSIGNED_BOUNDS: Record<string, { max: bigint }> = {
  u8: { max: 255n },
  u16: { max: 65535n },
  u32: { max: 4294967295n },
  u64: { max: 18446744073709551615n },
};

function checkBoundaryLiteral(
  value: bigint,
  targetType: CNextType,
  location: SourceLocation,
): void {
  const signed = SIGNED_BOUNDS[targetType];
  if (signed) {
    if (value === signed.min) {
      throw new CompilerError(
        `Literal ${value} equals ${targetType} minimum value. ` +
          `Use '${targetType}_MIN' for portable, unambiguous code.`,
        location,
      );
    }
    if (value === signed.max) {
      throw new CompilerError(
        `Literal ${value} equals ${targetType} maximum value. ` +
          `Use '${targetType}_MAX' for portable, unambiguous code.`,
        location,
      );
    }
  }

  const unsigned = UNSIGNED_BOUNDS[targetType];
  if (unsigned && value === unsigned.max) {
    throw new CompilerError(
      `Literal ${value} equals ${targetType} maximum value. ` +
        `Use '${targetType}_MAX' for portable, unambiguous code.`,
      location,
    );
  }
}

function generateNumericLiteral(
  value: bigint,
  isHex: boolean,
  targetType: CNextType,
): string {
  // Boundary values should have been caught earlier — this handles non-boundary

  // Determine if hex would be misinterpreted
  const signedMax = getSignedMaxForType(targetType);
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  const wouldBeUnsigned = isHex && absValue > signedMax;

  if (isNegative && wouldBeUnsigned) {
    // Convert to decimal (safe for non-boundary values)
    return value.toString();
  }

  // Safe to preserve original format
  return isHex ? formatAsHex(value) : value.toString();
}
```

---

## Safety Implications

### Without Fix

| Scenario                 | Risk                                  |
| ------------------------ | ------------------------------------- |
| Embedded boundary checks | **Critical** - safety limits bypassed |
| Protocol parsing         | **High** - incorrect message handling |
| Memory addressing        | **High** - wrong memory accessed      |
| Bitfield manipulation    | **Medium** - incorrect bit patterns   |

### With Fix

All numeric literals generate correct, portable C code regardless of:

- Host compiler (`sizeof(int)` variance)
- Target platform (16-bit, 32-bit, 64-bit)
- Literal format chosen by developer

---

## Decision

**Combined approach: Option E + Option D**

1. **Option E (Boundary values):** Emit compiler errors when literals equal TYPE_MIN or TYPE_MAX, requiring explicit named constants (`i32_MIN`, `u64_MAX`, etc.) that map to `<stdint.h>`.

2. **Option D (Other problematic values):** Silently convert non-boundary problematic hex literals to decimal in generated C code.

This provides educational safety for the most dangerous edge cases while automatically handling other problematic values without burdening the user.

## Acceptance Criteria

### Option E: MIN/MAX Constants

- [ ] Add `type_MIN` and `type_MAX` constants to the language (i8, i16, i32, i64, u8, u16, u32, u64)
- [ ] Map constants to `<stdint.h>` values (INT8_MIN, INT32_MAX, UINT64_MAX, etc.)
- [ ] Emit compiler error when literal equals a boundary value
- [ ] Error message suggests the appropriate constant to use
- [ ] Test: `i32_MIN` in switch case generates `INT32_MIN`
- [ ] Test: `-0x80000000` as i32 emits educational error
- [ ] Test: `0x7FFFFFFF` as i32 emits educational error
- [ ] Test: `0xFF` as u8 emits educational error (u8_MAX)

### Option D: Problematic Hex Conversion

- [ ] Detect hex literals that would be interpreted as unsigned in C
- [ ] Convert problematic hex to decimal in generated C
- [ ] Preserve safe hex literals as-is
- [ ] Test: `-0x1000` converts to `-4096`
- [ ] Test: `-0x7F` preserved as `-0x7F`
- [ ] Test: `-0xC0000000` converts to decimal

### General

- [ ] Verify generated C compiles without warnings
- [ ] Verify runtime behavior matches C-Next semantics
- [ ] Update documentation (learn-cnext-in-y-minutes.md) with MIN/MAX constants
- [ ] Update #111 with implementation details
