# ADR-054: Array Index Overflow Semantics

**Status:** Research (Pending Approval)
**Date:** 2026-01-23
**Updated:** 2026-02-22
**Decision Makers:** C-Next Language Design Team

## Context

C-Next already has per-variable overflow semantics for integers with `clamp` (saturate) and `wrap` (two's complement) keywords, defaulting to `clamp` for safety (ADR-044). A community member raised an insightful question:

> "Can your clamped be applied to an array index?"

This is a natural extension of C-Next's overflow philosophy. Buffer overflows (CWE-787) are the #2 most dangerous software weakness, and array bounds errors are endemic in embedded systems. Applying the same `clamp`/`wrap` semantics to array indexing could:

1. Eliminate out-of-bounds access bugs by construction
2. Make circular buffers (ring buffers) first-class citizens
3. Provide consistent overflow handling across the language

### The Problem in C

```c
uint8_t buffer[100];
int idx = get_index();  // Returns 105

buffer[idx] = value;    // UNDEFINED BEHAVIOR - writes past array!
```

C provides no bounds checking. The result is memory corruption, security vulnerabilities, or crashes.

### Current Embedded Workarounds

```c
// Manual bounds checking (verbose, error-prone)
if (idx >= 0 && idx < 100) {
    buffer[idx] = value;
}

// Modulo for circular buffers (easy to forget)
buffer[idx % BUFFER_SIZE] = value;

// Clamping (verbose)
idx = (idx < 0) ? 0 : (idx >= 100) ? 99 : idx;
buffer[idx] = value;
```

---

## Initial Proposal

### Declaration-Level Default + Per-Access Override

Extend `clamp`/`wrap` keywords to array declarations, with per-access override capability:

```cnx
// Declaration sets the default index behavior
u8[clamp 100] buffer;   // Out-of-bounds indices clamp to valid range
u8[wrap 256] ring;      // Out-of-bounds indices wrap (circular buffer)
u8[50] normal;          // Default is clamp (safe by default)

// Usage with declaration default
value <- buffer[105];        // Clamps: buffer[99]
ring[300] <- byte;           // Wraps: ring[44] (300 % 256)

// Per-access override
value <- buffer[wrap idx];   // Override: wrap instead of clamp
value <- ring[clamp idx];    // Override: clamp instead of wrap
```

### Three Behaviors: Clamp, Wrap, and Discard

| Behavior  | Read `buffer[105]`         | Write `buffer[105] <- x` | Use Case                |
| --------- | -------------------------- | ------------------------ | ----------------------- |
| `clamp`   | Returns `buffer[99]`       | Writes to `buffer[99]`   | Safe access to boundary |
| `wrap`    | Returns `buffer[5]`        | Writes to `buffer[5]`    | Circular buffers        |
| `discard` | Returns unchanged `result` | No-op (discarded)        | Ignore invalid data     |

The third option is a **silent no-op** — out-of-bounds access simply does nothing:

```cnx
u8[discard 100] buffer;

u8 result <- 42;
result <- buffer[105];   // result stays 42 (read ignored)
buffer[105] <- 99;       // Write discarded silently
```

**Research finding:** Vulkan's `robustBufferAccess2` uses "discard" for this exact behavior — out-of-bounds writes are silently ignored. This gives us strong industry precedent for the naming.

**Use cases:**

- Hardware registers (writes to reserved bits are ignored)
- Network protocols (invalid packets dropped silently)
- Defensive sensor reading (bad index returns last-known-good value)

### Index Type Safety

All bracket subscript expressions require unsigned integer types. Signed integers, floats, and other non-integer types produce a compile error. This applies uniformly to array access, bit access, and bit range access.

**Allowed index types:**

| Type                      | Allowed           | Rationale                               |
| ------------------------- | ----------------- | --------------------------------------- |
| `u8`, `u16`, `u32`, `u64` | Yes               | Primary index types                     |
| `bool`                    | Yes               | Safe (0/1), useful for lookup tables    |
| Enum members              | Yes               | Transpile to unsigned constants         |
| Integer literals          | Yes               | Most common case                        |
| `i8`, `i16`, `i32`, `i64` | **Compile error** | Negative indexes are undefined behavior |
| `f32`, `f64`              | **Compile error** | Not valid index types                   |

This follows the same approach as Rust (`usize` only) and Zig (`usize` only), but using C-Next's fixed-width unsigned types instead of a platform-sized type (see ADR-020).

```cnx
u8[100] buffer;
u32 idx <- 5;
buffer[idx] <- 0xFF;           // OK: u32 is unsigned

i32 signedIdx <- 3;
buffer[signedIdx] <- 0xFF;     // ERROR E0850: signed index

f32 floatIdx <- 2.5;
buffer[floatIdx] <- 0xFF;      // ERROR E0850: float index

// Enum indexing is allowed
enum EColor { RED, GREEN, BLUE, COUNT }
u8[EColor.COUNT] palette;
palette[EColor.RED] <- 0xFF;   // OK: enum member
```

### Consistency with Integer Overflow (ADR-044)

| Integer Overflow | Array Index         | Philosophy                |
| ---------------- | ------------------- | ------------------------- |
| `clamp u16 temp` | `u8[clamp 100] buf` | Declaration sets default  |
| `N/A`            | `buf[wrap idx]`     | Per-operation override    |
| Default: clamp   | Default: clamp      | Safe by default           |
| `--debug`: panic | `--debug`: panic    | Catch bugs in development |

**Note:** Integer overflow doesn't have a direct equivalent to the "no-op" behavior. This may be array-specific.

### Extension: Bounded Strings

The same `clamp`/`wrap`/`discard` semantics should apply to bounded strings (see ADR-045). However, strings introduce an additional complexity: they have **two bounds**.

#### The Two-Bounds Problem

```cnx
String<64> name <- "Hello";  // capacity=64, char_count=5
```

| Index       | Relative to char_count (5) | Relative to Capacity (64) |
| ----------- | -------------------------- | ------------------------- |
| `name[3]`   | ✅ Valid ('l')             | ✅ Valid                  |
| `name[10]`  | ❌ Past char_count         | ✅ Within capacity        |
| `name[100]` | ❌ Past char_count         | ❌ Past capacity          |

**Question:** Should bounds checking use the **current char_count** or the **fixed capacity**?

#### Recommendation: Check Against char_count for reads

For safety and predictability, index bounds should check against the **current string char_count**, not capacity (see ADR-058 for property naming):

```cnx
clamp String<64> name <- "Hello";  // char_count=5
name[10];   // Clamps to name[4] → 'o' (last valid char)
name[100];  // Clamps to name[4] → 'o'

wrap String<64> name <- "Hello";   // char_count=5
name[7];    // Wraps: 7 % 5 = 2 → 'l'
name[100];  // Wraps: 100 % 5 = 0 → 'H'

discard String<64> name <- "Hello";
u8 result <- 'X';
result <- name[10];  // result stays 'X' (read discarded)
```

#### Rationale

1. **Accessing uninitialized memory is a bug** — Even if index 10 is within capacity, it contains garbage
2. **Consistency with string semantics** — `.char_count` returns content length, indexing should respect it
3. **Safer default** — Prevents reading uninitialized data in the capacity buffer

#### Write Behavior

For writes, the behavior should be based on capacity and pad with spaces.

```cnx
clamp String<64> name <- "Hello";  // char_count=5
name[10] <- 'X';  // name → "Hello    X"
name[100] <- 'Y'; // name → "Hello    X                                                     Y"
name[100] <- "XYZ"; // compiler error if detected, panic in --debug mode, no-op otherwise
```

---

## Research: How Other Languages Handle This

### Rust

**Behavior:** Panic on out-of-bounds (runtime check)

| Method                     | Behavior                                | Use Case                                |
| -------------------------- | --------------------------------------- | --------------------------------------- |
| `array[idx]`               | Panics if out-of-bounds                 | Normal access, assumes valid index      |
| `array.get(idx)`           | Returns `Option<T>` (`None` if invalid) | Safe access when index might be invalid |
| `array.get_unchecked(idx)` | Undefined behavior if invalid           | Unsafe, performance-critical code       |

```rust
let arr = [1, 2, 3];
arr[10];              // PANIC at runtime
arr.get(10);          // Returns None
unsafe { arr.get_unchecked(10) }  // UB - memory corruption
```

**Performance:** "At the end of the day, the cost of pervasive runtime bounds checking is negligible. CPU branch prediction is simply good enough in practice that the cost of the extra couple of instructions and a branch effectively ends up being zero." — [Rust Performance Book](https://nnethercote.github.io/perf-book/bounds-checks.html)

**Compile-time optimization:** Constant indices are checked at compile time. Iterators (`for item in array`) avoid bounds checks entirely.

**Key insight:** Rust chose **panic** (fail-fast) over silent behavior. The `get()` method provides an explicit "maybe" path.

---

### Zig

**Behavior:** Panic in debug, configurable in release

| Build Mode   | Behavior                                 |
| ------------ | ---------------------------------------- |
| Debug        | Runtime bounds check, panic on violation |
| ReleaseSafe  | Runtime bounds check, panic on violation |
| ReleaseFast  | Bounds checks disabled (UB on violation) |
| ReleaseSmall | Bounds checks disabled (UB on violation) |

```zig
var arr = [_]u8{1, 2, 3};
_ = arr[10];  // Debug: panic! ReleaseFast: UB
```

**Per-block safety:** Zig allows disabling runtime safety for specific blocks using `@setRuntimeSafety(false)`.

**Compile-time checking:** Constant indices are checked at compile time. Zig's `comptime` evaluation can prove many bounds at compile time.

**Key insight:** Zig's approach is "trust but verify" — assumes code is correct in release, but verifies in debug. Different from C-Next's always-safe default.

> Source: [Zig Guide: Runtime Safety](https://zig.guide/language-basics/runtime-safety/)

---

### Ada/SPARK

**Behavior:** Exception (`Constraint_Error`) on out-of-bounds

Ada has two powerful features for array indexing:

#### 1. Range Types (Constrained Indices)

```ada
type Index is range 1 .. 100;
type My_Array is array (Index) of Integer;
Arr : My_Array;

Arr(101) := 5;  -- Raises Constraint_Error at runtime
```

#### 2. Modular Types (Natural Wrap-Around)

```ada
type Mod_Index is mod 256;  -- Wraps: 255 + 1 = 0
type Ring_Buffer is array (Mod_Index) of Byte;
Buffer : Ring_Buffer;

Buffer(300) := X;  -- 300 mod 256 = 44, writes to Buffer(44)
```

> "Wrap-around arithmetic means that `'Last + 1 = 0 = 'First`, and `'First - 1 = 'Last`." — [Ada Wikibooks](https://en.wikibooks.org/wiki/Ada_Programming/Types/mod)

**SPARK (Formal Verification):** SPARK can **prove at compile time** that array accesses are within bounds, eliminating runtime checks entirely.

```ada
procedure Safe_Access(Arr : in out My_Array; Idx : Index)
  with Pre => Idx in Arr'Range;  -- Precondition proves bounds
```

> "GNATprove can be used to demonstrate statically that none of these errors can ever occur at runtime." — [AdaCore SPARK Guide](https://learn.adacore.com/courses/intro-to-spark/chapters/03_Proof_Of_Program_Integrity.html)

**Key insight:** Ada's `mod` types are **exactly** what C-Next's `wrap` behavior should emulate. The type itself carries the wraparound semantics.

---

### Swift

**Behavior:** Fatal error (trap/crash) on out-of-bounds

```swift
var arr = [1, 2, 3]
arr[10] = 5  // Fatal error: Index out of range (crash)
```

**No recovery:** Unlike Rust's `get()`, Swift's array subscript always crashes. You must check bounds manually or use safe patterns.

**Safe patterns:**

```swift
// Safe extension pattern
extension Array {
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}

arr[safe: 10]  // Returns nil instead of crashing
```

**Overflow operators:** Swift has `&+`, `&-`, `&*` for integer overflow, but **no equivalent for array indices**.

> Source: [Swift Forums](https://forums.swift.org/t/what-does-array-indices-are-checked-for-out-of-bounds-errors-from-the-swift-book-mean/30422)

**Key insight:** Swift is aggressive about crashing. No silent behavior, no Option-based access by default.

---

### D Language

**Behavior:** Configurable based on `@safe` / `@system` attributes

| Context                | Bounds Checking                          |
| ---------------------- | ---------------------------------------- |
| `@safe`                | Always enabled (even in release)         |
| `@system`              | Disabled by default                      |
| `@trusted`             | Disabled, but interface is "vouched for" |
| Default (no attribute) | Enabled                                  |

```d
@safe void example() {
    int[] arr = [1, 2, 3];
    arr[10] = 5;  // Runtime error, even in release
}

@system void fast() {
    int[] arr = [1, 2, 3];
    arr[10] = 5;  // UB in release, no check
}
```

**Compiler flags:** `-boundscheck=off|safeonly|on` for fine-grained control.

> "Array bounds checks are necessary to enforce memory safety, so these are enabled (by default) for @safe code even in -release mode." — [D Language Spec](https://dlang.org/spec/arrays.html)

**Key insight:** D's approach of per-function safety attributes is interesting, but more complex than C-Next's per-variable approach.

---

### Java

**Behavior:** `ArrayIndexOutOfBoundsException` (catchable exception)

```java
int[] arr = {1, 2, 3};
arr[10] = 5;  // Throws ArrayIndexOutOfBoundsException
```

**JIT Bounds Check Elimination:** HotSpot JVM aggressively eliminates redundant bounds checks:

- Loop analysis: For counted loops, JVM computes safe index ranges and creates specialized loop copies
- Constant propagation: Constant indices checked at compile time
- **Up to 16% speedup** from combined bounds check elimination

> "Range check elimination in loops is a key optimization for Java because every array access is guarded by a bound check." — [Red Hat Developer](https://developers.redhat.com/articles/2022/03/16/range-check-elimination-loops-openjdks-hotspot-jvm)

**Key insight:** Java proves that aggressive bounds checking is viable with good JIT optimization.

---

### C#

**Behavior:** `IndexOutOfRangeException` (catchable exception)

```csharp
int[] arr = {1, 2, 3};
arr[10] = 5;  // Throws IndexOutOfRangeException
```

**Span<T>:** Modern C# uses `Span<T>` for performance-critical code, which still includes bounds checking but is highly optimized.

**Unsafe code:** In `unsafe` context, pointer arithmetic bypasses bounds checking entirely.

```csharp
unsafe {
    fixed (int* p = arr) {
        p[10] = 5;  // No bounds check, potential corruption
    }
}
```

> "If you do not use the .Length property of the array you are looping over, the bounds check will be present." — [Tedds Blog](https://blog.tedd.no/2020/06/01/faster-c-array-access/)

**Key insight:** Similar to Java. Managed languages accept runtime cost for safety.

---

### TypeScript/JavaScript

**Behavior:** Returns `undefined` for reads, silently extends array for writes

```javascript
const arr = [1, 2, 3];
console.log(arr[10]); // undefined (no error!)
arr[10] = 5; // arr is now [1, 2, 3, <7 empty>, 5]
```

**This is the "no-op" behavior for reads!** JavaScript returns `undefined` instead of crashing.

**TypeScript `noUncheckedIndexedAccess`:** TypeScript 4.1+ can flag this:

```typescript
// tsconfig.json: "noUncheckedIndexedAccess": true
const arr: number[] = [1, 2, 3];
const val = arr[10]; // Type is number | undefined
```

> "In many languages, accessing past the bounds of an array throws an error. But in JavaScript, if you try to access an out-of-bound element of an array, you'll get `undefined`." — [TypeScript TV](https://typescript.tv/best-practices/safer-array-access-in-typescript/)

**Key insight:** JavaScript's `undefined` return is effectively the "ignore/skip" behavior for reads. C-Next could study this pattern.

---

### Vulkan/WebGPU (GPU Programming)

**Behavior:** "Robust buffer access" with **clamping**

Vulkan's `robustBufferAccess` feature provides bounds-safe GPU memory access:

| Feature               | Out-of-Bounds Read            | Out-of-Bounds Write |
| --------------------- | ----------------------------- | ------------------- |
| `robustBufferAccess`  | Returns zero or clamped value | May modify buffer   |
| `robustBufferAccess2` | Returns zero                  | Discarded (no-op)   |

> "The strategy to add robust buffer access is to make pointers that would be out of bounds be 'clamped' to be in bounds." — [Vulkan Docs](https://docs.vulkan.org/guide/latest/robustness.html)

**Key insight:** GPU world already uses the term **"clamp"** for this behavior! And `robustBufferAccess2` provides a **discard/no-op** option for writes.

---

## Research: Compile-Time vs Runtime Checking

### When Can Bounds Be Proven at Compile Time?

| Scenario                                          | Can Prove at Compile Time?       |
| ------------------------------------------------- | -------------------------------- |
| Constant index: `arr[5]`                          | ✅ Yes                           |
| Loop with known bounds: `for i in 0..<arr.length` | ✅ Yes (with analysis)           |
| User input index                                  | ❌ No                            |
| Computed index                                    | ⚠️ Sometimes (range propagation) |

**SPARK's approach:** Use preconditions and loop invariants to prove bounds:

```ada
procedure Access(Arr : My_Array; Idx : Integer)
  with Pre => Idx in Arr'Range;  -- Caller must prove
```

### Runtime Check Performance

**Bounds check cost:**

- Adds `cmp` + conditional branch per access
- CPU branch prediction makes cost "negligible" for predictable patterns
- **77% overhead** in worst case (SoftBound), **reduced to 51%** with optimization
- Java JIT eliminates **most** checks in loops

**Modulo operation cost:**

- Division is one of the **slowest** CPU operations
- Power-of-2 optimization: `idx & (size - 1)` is very fast
- Non-power-of-2: Full division required

| Operation                    | Relative Cost            |
| ---------------------------- | ------------------------ |
| Bounds check (predictable)   | ~0 (branch predicted)    |
| Bounds check (unpredictable) | ~10-20 cycles            |
| Modulo (power-of-2)          | ~1 cycle (bitwise AND)   |
| Modulo (general)             | ~20-80 cycles (division) |

> "If N happens to be a base-2 number (like 64, 1024, or 4096), `i mod N` is computationally equivalent to using a binary AND operator (`i and (N-1)`), which is more efficient." — [High Performance Modulo](https://www.chrisnewland.com/high-performance-modulo-operation-317)

**Implication for C-Next:** For `wrap` behavior, encourage power-of-2 array sizes or warn about performance.

---

## Research: MISRA and Safety Standards

**MISRA C** requires defensive programming but doesn't mandate a specific bounds-checking approach:

- **Rule 18.1:** "A pointer resulting from arithmetic on a pointer operand shall address an element of the same array as that pointer operand"
- In practice: Manual bounds checks required before every access

**DO-178C (Aerospace):** Requires proof that buffer overflows cannot occur. SPARK is specifically designed for this.

**Key insight:** Safety standards want **proof** of safety, not just runtime checks. C-Next's static `clamp`/`wrap` approach can be statically analyzed more easily than dynamic checks.

---

## Research Summary: Language Comparison

| Language              | Default Behavior                 | Alternative Access    | Wrap Support      | No-Op Support |
| --------------------- | -------------------------------- | --------------------- | ----------------- | ------------- |
| **Rust**              | Panic                            | `get()` → Option      | ❌ Manual         | ❌            |
| **Zig**               | Panic (debug) / UB (release)     | —                     | ❌ Manual         | ❌            |
| **Ada**               | Exception                        | Modular types         | ✅ `mod` types    | ❌            |
| **Swift**             | Crash (trap)                     | Manual extension      | ❌                | ❌            |
| **D**                 | Exception (@safe) / UB (@system) | —                     | ❌ Manual         | ❌            |
| **Java**              | Exception                        | —                     | ❌ Manual         | ❌            |
| **C#**                | Exception                        | `unsafe`              | ❌ Manual         | ❌            |
| **JavaScript**        | `undefined` / extend             | —                     | ❌ Manual         | ✅ Implicit   |
| **Vulkan/GPU**        | Clamp                            | `robustBufferAccess2` | ❌                | ✅ Discard    |
| **C-Next (proposed)** | Clamp                            | Per-access override   | ✅ `wrap` keyword | ✅ discard    |

### Key Findings

1. **No language provides all three behaviors** (clamp, wrap, discard) with clean syntax
2. **Ada's `mod` types** are the closest precedent to C-Next's `wrap` behavior
3. **Vulkan calls the no-op write behavior "discard"** — strong naming precedent
4. **JavaScript returns `undefined`** for out-of-bounds reads — implicit "skip" behavior
5. **Most languages choose panic/exception** as default, C-Next's `clamp` default is novel

---

## Design Principles (From Discussion)

1. **Safe by default** - `clamp` is the default, preventing memory corruption
2. **Explicit opt-in** - `wrap` and `discard` behaviors require declaration, documenting intent
3. **Three behaviors** - `clamp` (boundary), `wrap` (circular), `discard` (ignore)
4. **Override flexibility** - Per-access syntax allows exceptions
5. **Consistency** - Same keywords as integer overflow (`clamp`/`wrap`), plus `discard`
6. **No silent failures in debug** - `--debug` mode panics on any out-of-bounds

---

## Decision

### Core Feature: Array Index Overflow with `clamp`/`wrap`/`discard`

Extend the `clamp`/`wrap` keywords (and add `discard`) to array dimension declarations. The overflow modifier sits **inside the brackets** alongside the size, which is distinct from integer overflow (`clamp u8`) because they control different things:

- `clamp u8` — clamps the **value** stored in the variable
- `u8[clamp 100]` — clamps the **index** used to access the array

These are orthogonal and composable:

```cnx
wrap u8[discard 256] buffer;
// wrap: values stored in buffer saturate via two's complement
// discard: out-of-bounds index access is a no-op

buffer[0] <- 1000;    // value wraps: 1000 % 256 = 232
buffer[1000] <- 0;     // index discarded: no-op
```

### Syntax

#### Declaration

```cnx
u8[100] buffer;            // Default: clamp (safe by default)
u8[clamp 100] buffer;      // Explicit clamp (same as default)
u8[wrap 256] ring;          // Wrapping index (circular buffer)
u8[discard 100] sensorData; // Discarding index (no-op on OOB)
```

#### Per-Access Override

The per-access override places the keyword before the index expression inside the brackets. The parser distinguishes this by token count: `[wrap]` (1 token) is a variable name; `[wrap idx]` (2 tokens) is a keyword + expression.

```cnx
u8[clamp 100] buffer;
value <- buffer[wrap idx];   // Override: wrap instead of clamp
value <- buffer[discard idx]; // Override: discard instead of clamp
```

#### Multi-Dimensional Arrays

Each dimension has its own independent overflow behavior, defaulting to `clamp`:

```cnx
u32[clamp 10][wrap 20] matrix;
// dim 0: clamp (explicit), dim 1: wrap

u32[10][20] grid;
// dim 0: clamp (default), dim 1: clamp (default)

matrix[15][25] <- 5;  // dim 0 clamps to 9, dim 1 wraps: 25 % 20 = 5
```

Per-access overrides also apply per-dimension:

```cnx
matrix[wrap i][clamp j] <- value;  // Each dimension overridden independently
```

### Behaviors

| Behavior  | Read `buffer[105]` (size 100)  | Write `buffer[105] <- x`       | Use Case                |
| --------- | ------------------------------ | ------------------------------ | ----------------------- |
| `clamp`   | Returns `buffer[99]`           | Writes to `buffer[99]`         | Safe access to boundary |
| `wrap`    | Returns `buffer[5]`            | Writes to `buffer[5]`          | Circular buffers        |
| `discard` | Result unchanged (zero if new) | No-op (write silently ignored) | Ignore invalid data     |

### Philosophy: Safety Nets, Not Features

**Critical:** `clamp`, `wrap`, and `discard` are **safety nets**, not features. They prevent undefined behavior when an index is unexpectedly out of bounds. Developers should still handle bounds intentionally — these keywords catch the bugs that slip through.

This means:

- Compile-time warnings remain for constant OOB indices, even when clamp/wrap/discard would handle them safely at runtime
- `--debug` mode panics on **all three behaviors** when an OOB access occurs, because hitting the safety net means a bug exists
- There is **no "unchecked" or "raw" mode** — this goes against C-Next's core safety philosophy

### Default Behavior

All array access defaults to `clamp`. This means existing code without explicit overflow modifiers will gain bounds-checking code generation. This is intentional and non-negotiable — C-Next eliminates buffer overflows by construction.

### Debug Mode

In `--debug` mode, **all** out-of-bounds accesses panic regardless of the declared overflow behavior:

```c
// --debug mode generated C (all behaviors)
if ((size_t)idx >= 100) {
    fprintf(stderr, "Array index out of bounds: %zu >= 100 at %s:%d\n",
            (size_t)idx, __FILE__, __LINE__);
    abort();
}
```

### Constant Index Optimization

When the index is a compile-time constant and provably within bounds, **no bounds-checking code is generated**:

```cnx
u8[clamp 100] buffer;
buffer[5] <- 0xFF;    // 5 < 100: no clamping code generated, direct access
buffer[idx] <- 0xFF;  // idx unknown: clamping code generated
```

When the index is a compile-time constant and out of bounds, a **compile-time warning** is emitted (the safety net catches it, but the developer should fix the code).

### Index Type Safety

Already implemented. All bracket subscript expressions require unsigned integer types. Signed integers and floats produce compile error E0850.

### Array Slices

Overflow behavior applies to slice offsets as well:

```cnx
u8[clamp 100] buffer;
buffer[95, 10] <- source;  // offset 95 clamped, slice bounds checked
```

### Bounded Strings

The same `clamp`/`wrap`/`discard` semantics apply to bounded strings (ADR-045), with special handling for the two-bounds problem:

#### Reads: Check Against Current char_count

```cnx
clamp String<64> name <- "Hello";  // char_count=5
name[10];   // Clamps to name[4] → 'o' (last valid char)
name[100];  // Clamps to name[4] → 'o'
```

Rationale: Accessing past the current char_count reads uninitialized memory, which is always a bug.

#### Writes: Check Against Capacity, Pad with Spaces

```cnx
clamp String<64> name <- "Hello";  // char_count=5
name[10] <- 'X';  // name → "Hello     X", .char_count becomes 11
name[3] <- 'X';   // name → "HelXo", .char_count stays 5
```

When writing past the current char_count but within capacity:

- The gap is filled with space characters (` `)
- `.char_count` is updated to include the new character
- The null terminator moves to the new `char_count` position (C string invariant maintained)
- Clamping applies against capacity (not char_count) for writes

### New Error Codes

| Code  | Meaning                                            |
| ----- | -------------------------------------------------- |
| E0854 | Compile-time warning: constant index out of bounds |
| E0855 | Invalid overflow modifier in array dimension       |

(E0850–E0853 already used for index type safety and critical section errors)

---

## Implementation

### Generated C

#### Clamp (Default)

```cnx
// C-Next
u8[clamp 100] buffer;
value <- buffer[idx];
```

```c
// Generated C (indices are always unsigned, no < 0 check needed)
uint8_t buffer[100];
value = buffer[idx >= 100 ? 99 : idx];
```

#### Wrap

```cnx
// C-Next
u8[wrap 256] ring;
ring[head] <- byte;
```

```c
// Generated C (power-of-2 optimization)
uint8_t ring[256];
ring[head & 255] = byte;  // Bitwise AND for power-of-2 sizes
```

```cnx
// C-Next (non-power-of-2)
u8[wrap 100] ring;
ring[head] <- byte;
```

```c
// Generated C (general case)
uint8_t ring[100];
ring[head % 100] = byte;   // Modulo for non-power-of-2 sizes
```

#### Discard

```cnx
// C-Next
u8[discard 100] sensorData;
result <- sensorData[idx];
sensorData[idx] <- newValue;
```

```c
// Generated C
uint8_t sensorData[100];

// Discard read: unchanged if out of bounds
if (idx < 100) {
    result = sensorData[idx];
}

// Discard write: silently ignored if out of bounds
if (idx < 100) {
    sensorData[idx] = newValue;
}
```

#### Constant Index (Optimized — No Bounds Code)

```cnx
u8[clamp 100] buffer;
buffer[5] <- 0xFF;
```

```c
// Generated C — index provably in bounds, no clamping emitted
uint8_t buffer[100];
buffer[5] = 0xFF;
```

#### Debug Mode (All Behaviors)

```cnx
// --debug
u8[wrap 256] ring;
ring[head] <- byte;
```

```c
// Generated C (--debug)
uint8_t ring[256];
if (head >= 256) {
    fprintf(stderr, "Array index out of bounds: %u >= 256 at %s:%d\n",
            head, __FILE__, __LINE__);
    abort();
}
ring[head & 255] = byte;
```

---

## References

### C-Next ADRs

- [ADR-044: Primitive Types](adr-044-primitive-types.md) - Integer overflow with `clamp`/`wrap`
- [ADR-008: Language-Level Bug Prevention](adr-008-language-bug-prevention.md) - Buffer overflow prevention strategy
- [ADR-035: Array Initializers](adr-035-array-initializers.md) - Array syntax decisions
- [ADR-003: Static Allocation](adr-003-static-allocation.md) - Memory model

### Security

- [CWE-787: Out-of-bounds Write](https://cwe.mitre.org/data/definitions/787.html) - #2 most dangerous weakness (2024)
- [CWE-125: Out-of-bounds Read](https://cwe.mitre.org/data/definitions/125.html) - #5 most dangerous weakness (2024)

### Language Research

#### Rust

- [Rust Performance Book: Bounds Checks](https://nnethercote.github.io/perf-book/bounds-checks.html)
- [How to avoid bounds checks in Rust](https://shnatsel.medium.com/how-to-avoid-bounds-checks-in-rust-without-unsafe-f65e618b4c1e)
- [How much does Rust's bounds checking actually cost?](https://readyset.io/blog/bounds-checks)

#### Zig

- [Zig Guide: Runtime Safety](https://zig.guide/language-basics/runtime-safety/)
- [Memory Safety Features in Zig](https://gencmurat.com/en/posts/memory-safety-features-in-zig/)

#### Ada/SPARK

- [AdaCore: Arrays](https://learn.adacore.com/courses/intro-to-ada/chapters/arrays.html)
- [Ada Modular Types](https://en.wikibooks.org/wiki/Ada_Programming/Types/mod)
- [SPARK: Proof of Program Integrity](https://learn.adacore.com/courses/intro-to-spark/chapters/03_Proof_Of_Program_Integrity.html)
- [GNAT Bounded Buffer Example](https://www.adacore.com/gems/gem-37)

#### Swift

- [Swift Forums: Array bounds checking](https://forums.swift.org/t/what-does-array-indices-are-checked-for-out-of-bounds-errors-from-the-swift-book-mean/30422)
- [Handling Index Out of Range the Swift Way](https://www.vadimbulavin.com/handling-out-of-bounds-exception/)
- [Swift Overflow Operators](https://coderscratchpad.com/swift-overflow-operators/)

#### D Language

- [D Language: Arrays](https://dlang.org/spec/arrays.html)
- [Memory-Safe-D-Spec](https://dlang.org/spec/memory-safe-d.html)

#### Java

- [Red Hat: Range check elimination in HotSpot JVM](https://developers.redhat.com/articles/2022/03/16/range-check-elimination-loops-openjdks-hotspot-jvm)
- [Array Bounds Check Elimination for Java](https://link.springer.com/content/pdf/10.1007/3-540-45937-5_23.pdf)

#### TypeScript/JavaScript

- [Avoiding runtime errors with array indexing in TypeScript](https://blog.ignacemaes.com/avoiding-runtime-errors-with-array-indexing-in-typescript/)
- [Safer Array Access with TypeScript 4.1](https://typescript.tv/best-practices/safer-array-access-in-typescript/)

#### GPU/Vulkan

- [Vulkan Robustness Guide](https://docs.vulkan.org/guide/latest/robustness.html)
- [WebGPU: Out of bounds memory access](https://github.com/gpuweb/gpuweb/issues/3893)

### Performance

- [Wikipedia: Bounds-checking elimination](https://en.wikipedia.org/wiki/Bounds-checking_elimination)
- [High Performance Modulo Operation](https://www.chrisnewland.com/high-performance-modulo-operation-317)
- [SEI: Performance of Compiler-Assisted Memory Safety Checking](https://www.sei.cmu.edu/blog/performance-of-compiler-assisted-memory-safety-checking/)
