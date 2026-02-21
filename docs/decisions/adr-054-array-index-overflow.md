# ADR-054: Array Index Overflow Semantics

**Status:** Research
**Date:** 2026-01-23
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
clamp u8[100] buffer;   // Out-of-bounds indices clamp to valid range
wrap u8[256] ring;      // Out-of-bounds indices wrap (circular buffer)
u8[50] normal;          // Default is clamp (safe by default)

// Usage with declaration default
value <- buffer[105];        // Clamps: buffer[99]
value <- buffer[-5];         // Clamps: buffer[0]
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
discard u8[100] buffer;

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
| `clamp u16 temp` | `clamp u8[100] buf` | Declaration sets default  |
| `temp +wrap 1`   | `buf[wrap idx]`     | Per-operation override    |
| Default: clamp   | Default: clamp      | Safe by default           |
| `--debug`: panic | `--debug`: panic    | Catch bugs in development |

**Note:** Integer overflow doesn't have a direct equivalent to the "no-op" behavior. This may be array-specific.

### Killer Use Case: Circular Buffers

Circular/ring buffers are fundamental to embedded systems (UART, SPI, audio, sensors). Currently they require manual modulo operations:

```c
// C: Manual and error-prone
uint8_t rx_buffer[256];
volatile uint8_t head = 0;

void uart_isr(void) {
    rx_buffer[head % 256] = UART_DR;  // Easy to forget the % 256
    head = (head + 1) % 256;          // Must remember here too
}
```

With C-Next array index overflow:

```cnx
// C-Next: Intent declared once, enforced everywhere
wrap u8[256] rxBuffer;
wrap u8 head <- 0;

void uart_isr() {
    rxBuffer[head] <- UART.DR;  // Wraps automatically at 256
    head <- head + 1;            // Also wraps (integer overflow)
}
```

The circular buffer behavior is declared at the type level, not scattered throughout the code.

### Extension: Bounded Strings

The same `clamp`/`wrap`/`discard` semantics should apply to bounded strings (see ADR-045). However, strings introduce an additional complexity: they have **two bounds**.

#### The Two-Bounds Problem

```cnx
String<64> name <- "Hello";  // capacity=64, length=5
```

| Index       | Relative to Length (5) | Relative to Capacity (64) |
| ----------- | ---------------------- | ------------------------- |
| `name[3]`   | ✅ Valid ('l')         | ✅ Valid                  |
| `name[10]`  | ❌ Past length         | ✅ Within capacity        |
| `name[100]` | ❌ Past length         | ❌ Past capacity          |

**Question:** Should bounds checking use the **current length** or the **fixed capacity**?

#### Recommendation: Check Against Length

For safety and predictability, index bounds should check against the **current string length**, not capacity:

```cnx
clamp String<64> name <- "Hello";  // length=5
name[10];   // Clamps to name[4] → 'o' (last valid char)
name[100];  // Clamps to name[4] → 'o'

wrap String<64> name <- "Hello";   // length=5
name[7];    // Wraps: 7 % 5 = 2 → 'l'
name[100];  // Wraps: 100 % 5 = 0 → 'H'

discard String<64> name <- "Hello";
u8 result <- 'X';
result <- name[10];  // result stays 'X' (read discarded)
```

#### Rationale

1. **Accessing uninitialized memory is a bug** — Even if index 10 is within capacity, it contains garbage
2. **Consistency with string semantics** — `.length` returns content length, indexing should respect it
3. **Safer default** — Prevents reading uninitialized data in the capacity buffer

#### Write Behavior

For writes, the behavior depends on whether we're _extending_ the string or _modifying_ existing content:

```cnx
clamp String<64> name <- "Hello";  // length=5
name[10] <- 'X';  // Clamps to name[4] = 'X' → "HellX"
                  // OR: Error because modifying, not appending?
```

**Open question:** Should writes past length be allowed to extend the string (up to capacity), or should they follow the same bounds as reads?

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

| Language              | Default Behavior                 | Alternative Access    | Wrap Support      | No-Op Support  |
| --------------------- | -------------------------------- | --------------------- | ----------------- | -------------- |
| **Rust**              | Panic                            | `get()` → Option      | ❌ Manual         | ❌             |
| **Zig**               | Panic (debug) / UB (release)     | —                     | ❌ Manual         | ❌             |
| **Ada**               | Exception                        | Modular types         | ✅ `mod` types    | ❌             |
| **Swift**             | Crash (trap)                     | Manual extension      | ❌                | ❌             |
| **D**                 | Exception (@safe) / UB (@system) | —                     | ❌ Manual         | ❌             |
| **Java**              | Exception                        | —                     | ❌ Manual         | ❌             |
| **C#**                | Exception                        | `unsafe`              | ❌ Manual         | ❌             |
| **JavaScript**        | `undefined` / extend             | —                     | ❌ Manual         | ✅ Implicit    |
| **Vulkan/GPU**        | Clamp                            | `robustBufferAccess2` | ❌                | ✅ Discard     |
| **C-Next (proposed)** | Clamp                            | Per-access override   | ✅ `wrap` keyword | ✅ TBD keyword |

### Key Findings

1. **No language provides all three behaviors** (clamp, wrap, discard) with clean syntax
2. **Ada's `mod` types** are the closest precedent to C-Next's `wrap` behavior
3. **Vulkan calls the no-op write behavior "discard"** — strong naming precedent
4. **JavaScript returns `undefined`** for out-of-bounds reads — implicit "skip" behavior
5. **Most languages choose panic/exception** as default, C-Next's `clamp` default is novel

---

## Open Questions

### Q1: Name for "No-Op" Behavior

What should the third behavior (silent ignore) be called?

**Research finding:** Vulkan uses **"discard"** for out-of-bounds writes that are silently ignored (`robustBufferAccess2`).

| Candidate     | Pros                                         | Cons                            | Precedent     |
| ------------- | -------------------------------------------- | ------------------------------- | ------------- |
| **`discard`** | Explicit about data loss, industry precedent | 7 characters                    | ✅ Vulkan/GPU |
| `skip`        | Short (4 chars), clear                       | Could confuse with loop control | —             |
| `ignore`      | Clear intent                                 | Might imply logging             | —             |
| `guard`       | Implies protection                           | Doesn't describe write behavior | —             |
| `silent`      | Describes behavior                           | Adjective, not verb             | —             |
| `noop`        | Technical, accurate                          | Jargon-y                        | —             |

**Recommendation:** `discard` — it has industry precedent (Vulkan) and clearly communicates that out-of-bounds writes are thrown away.

### Q2: Syntax for Per-Access Override

Should the override keyword go before or after the index?

```cnx
// Option A: Keyword before index
buffer[wrap idx]
buffer[clamp idx]

// Option B: Keyword as operator on index
buffer[idx wrap]
buffer[idx clamp]

// Option C: Method-like syntax
buffer.wrap(idx)
buffer.clamp(idx)
```

### Q3: Negative Index Handling

How should negative indices behave?

```cnx
wrap u8[100] buffer;
value <- buffer[-1];  // Option A: Wraps to buffer[99] (Python-like)
                      // Option B: Wraps to buffer[?] (modulo behavior unclear for negative)
                      // Option C: Always clamp negative to 0 regardless of wrap
```

### Q4: Multi-Dimensional Arrays

How does this extend to multi-dimensional arrays?

```cnx
wrap u8[10][10] matrix;
value <- matrix[15][20];  // Both indices wrap? Or just one?

// Can dimensions have different behaviors?
// wrap/clamp u8 matrix[10][10]; ???
```

### Q5: Interaction with Sizeof/Length

If an array clamps, does `.length` still return the declared size?

```cnx
clamp u8[100] buffer;
u32 len <- buffer.length;  // 100 (declared size)
buffer[150] <- 0;          // Writes to buffer[99]
// Is this confusing? Length says 100, but 150 "works"
```

### Q6: Performance Implications

- Is clamp checking more expensive than wrap (modulo)?
- Should there be a way to disable checks in release builds?
- How does this interact with `--debug` mode?

### Q7: Pointer/Reference Semantics

If C-Next adds limited pointer support for C interop, how do bounds apply?

### Q8: Bounded String Index Bounds

For bounded strings like `String<64>`, should index bounds check against:

| Option            | `String<64> s <- "Hello"` then `s[10]` | Pros                   | Cons                      |
| ----------------- | -------------------------------------- | ---------------------- | ------------------------- |
| **Length** (5)    | Out-of-bounds                          | Safe, no garbage reads | Length changes at runtime |
| **Capacity** (64) | In-bounds (reads garbage)              | Simpler, static        | Unsafe default            |

**Recommendation:** Check against length. Capacity is a maximum, not a guarantee of valid data.

### Q9: String Write Extension

Should writing past string length (but within capacity) extend the string?

```cnx
String<64> name <- "Hi";  // length=2, capacity=64
name[5] <- 'X';           // Option A: Extend to "Hi   X" (length=6)?
                          // Option B: Clamp to name[1] = 'X' → "HX"?
                          // Option C: Error (use .append() instead)?
```

This affects whether strings are "array-like" (direct index writes) or "string-like" (append/insert methods only).

---

## Design Principles (From Discussion)

1. **Safe by default** - `clamp` is the default, preventing memory corruption
2. **Explicit opt-in** - `wrap` and `discard` behaviors require declaration, documenting intent
3. **Three behaviors** - `clamp` (boundary), `wrap` (circular), `discard` (ignore)
4. **Override flexibility** - Per-access syntax allows exceptions
5. **Consistency** - Same keywords as integer overflow (`clamp`/`wrap`), plus `discard`
6. **No silent failures in debug** - `--debug` mode panics on any out-of-bounds

---

## Potential Implementation

### Grammar Changes

```antlr
// Array declaration with optional overflow behavior
arrayDeclaration
    : indexBehavior? type arrayDimension+ IDENTIFIER ('<-' arrayInitializer)? ';'
    ;

indexBehavior
    : 'clamp'    // Default: out-of-bounds clamps to valid range
    | 'wrap'     // Circular: index wraps modulo array size
    | 'discard'  // Silent: out-of-bounds access is no-op
    ;

// Array access with optional override
arrayAccess
    : IDENTIFIER '[' indexOverride? expression ']'
    ;

indexOverride
    : 'clamp'
    | 'wrap'
    | 'discard'
    ;
```

### Generated C

```cnx
// C-Next
clamp u8[100] buffer;
value <- buffer[idx];
```

```c
// Generated C
uint8_t buffer[100];

// Clamped access
size_t _idx_clamped = (idx < 0) ? 0 : ((size_t)idx >= 100) ? 99 : (size_t)idx;
value = buffer[_idx_clamped];
```

```cnx
// C-Next
wrap u8[256] ring;
ring[head] <- byte;
```

```c
// Generated C (power-of-2 optimization)
uint8_t ring[256];
ring[head & 0xFF] = byte;  // Bitwise AND for power-of-2 sizes

// Non-power-of-2
uint8_t ring[100];
ring[head % 100] = byte;   // Modulo for other sizes
```

```cnx
// C-Next
discard u8[100] sensorData;
result <- sensorData[idx];
sensorData[idx] <- newValue;
```

```c
// Generated C
uint8_t sensorData[100];

// Discard read: returns unchanged if out of bounds
if ((size_t)idx < 100) {
    result = sensorData[idx];
}
// else: result unchanged

// Discard write: silently ignored if out of bounds
if ((size_t)idx < 100) {
    sensorData[idx] = newValue;
}
// else: write discarded
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
