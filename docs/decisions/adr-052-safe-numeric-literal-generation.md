# ADR-052: Safe Numeric Literal Generation

## Status

**Research**

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
case (int32_t)(-0x80000000): { break; }  // ❌ Invalid: case requires constant expression
```

**Pros:**

- Most explicit about intent
- Uses stdint types for portability

**Cons:**

- **Invalid for case labels** - C requires integer constant expressions, casts may not qualify
- Verbose output
- May generate warnings

### Option D: Hybrid Approach

**Approach:** Use decimal for problematic values, preserve hex for safe values.

**Logic:**

1. If hex value fits in target signed type without ambiguity → preserve hex
2. If hex value would be interpreted as unsigned → convert to decimal

**C-Next input:**

```cnx
case -0x7F { }       // Safe: 127 fits in signed int
case -0x80000000 { } // Unsafe: would be unsigned
```

**Generated C:**

```c
case -0x7F: { break; }      // Preserved
case -2147483648: { break; } // Converted
```

**Pros:**

- Preserves formatting when safe
- Correct semantics always
- Best of both worlds

**Cons:**

- More complex implementation
- Threshold depends on target type

---

## Recommendation

**Option D (Hybrid)** provides the best balance:

1. **Correctness first:** Always generates semantically correct C
2. **Readability preserved:** Keeps hex formatting when it's safe
3. **No platform variance:** Decimal literals are unambiguous
4. **No suffix complexity:** Avoids `L` vs `LL` platform differences

### Implementation Sketch

```typescript
function generateNumericLiteral(
  value: bigint,
  isHex: boolean,
  targetType: CNextType,
): string {
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;

  // Determine if hex would be misinterpreted
  const signedMax = getSignedMaxForType(targetType);
  const wouldBeUnsigned = isHex && absValue > signedMax;

  if (isNegative && wouldBeUnsigned) {
    // Convert to decimal to avoid unsigned interpretation
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

**TBD** - Awaiting review and acceptance.

## Acceptance Criteria

- [ ] Negative hex literals generate correct C code
- [ ] Add test for `-0x80000000` specifically
- [ ] Add test for `-0x8000` (16-bit boundary)
- [ ] Verify generated C compiles without warnings
- [ ] Verify runtime behavior matches C-Next semantics
- [ ] Document approach in this ADR
- [ ] Update #111 with implementation details
