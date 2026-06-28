# ADR-007: Type-Aware Bit Indexing

**Status:** Implemented
**Date:** 2025-12-26
**Decision Makers:** C-Next Language Design Team

## Context

Bit manipulation in embedded C is verbose and error-prone:

```c
// Traditional C - verbose and error-prone
uint8_t flags = 0;
flags |= (1 << 3);           // Set bit 3
flags &= ~(1 << 3);          // Clear bit 3
bool isSet = (flags >> 3) & 1;  // Read bit 3

// Bit ranges require masks
uint8_t field = (flags >> 4) & 0x0F;  // Read 4 bits at position 4
flags = (flags & ~(0x0F << 4)) | ((value & 0x0F) << 4);  // Write 4 bits
```

Problems with this approach:

1. **Verbose** — Simple bit operations require complex expressions
2. **Error-prone** — Easy to get shift amounts or masks wrong
3. **No bounds checking** — Nothing stops you from accessing bit 9 of a u8
4. **Repeated patterns** — Same bit manipulation code everywhere
5. **No type awareness** — C doesn't know u8 is 8 bits, u32 is 32 bits

### The Key Insight

The transpiler already knows type information:

- `u8` is 8 bits
- `u32` is 32 bits
- `buffer[16]` has 16 elements

**Why not expose this to the programmer?**

---

## Decision

### 1. Integers Are Indexable as Bit Arrays

Any integer type can be indexed to access individual bits:

```cnx
u8 flags <- 0;
flags[3] <- true;           // Set bit 3
flags[3] <- false;          // Clear bit 3
bool isSet <- flags[3];     // Read bit 3
```

**Generated C:**

```c
uint8_t flags = 0;
flags = (flags & ~(1 << 3)) | ((1) << 3);   // Set
flags = (flags & ~(1 << 3)) | ((0) << 3);   // Clear
bool isSet = ((flags >> 3) & 1);             // Read
```

### 2. Bit Range Syntax: [start, width]

Access multiple bits with `[start, width]` syntax:

```cnx
u8 flags <- 0;
flags[0, 3] <- 5;           // Set 3 bits starting at bit 0 to value 5
u8 field <- flags[4, 4];    // Read 4 bits starting at bit 4
```

**Generated C:**

```c
uint8_t flags = 0;
flags = (flags & ~(((1 << 3) - 1) << 0)) | ((5 & ((1 << 3) - 1)) << 0);
uint8_t field = ((flags >> 4) & ((1 << 4) - 1));
```

### 3. The .length Property

Every type exposes its size via `.length`:

| Type              | `.length` Value   |
| ----------------- | ----------------- |
| `u8`              | 8 (bit width)     |
| `u16`             | 16 (bit width)    |
| `u32`             | 32 (bit width)    |
| `u64`             | 64 (bit width)    |
| `i8`, `i16`, etc. | Same as unsigned  |
| `bool`            | 1 (bit width)     |
| `T[N]`            | N (element count) |

```cnx
u8[16] buffer;
u32 counter <- 0;

u32 arrLen <- buffer.length;     // 16 (array element count)
u32 bits <- counter.length;      // 32 (u32 bit width)
```

**Generated C:**

```c
uint8_t buffer[16];
uint32_t counter = 0;

uint32_t arrLen = 16;    // Compile-time constant
uint32_t bits = 32;      // Compile-time constant
```

---

## Syntax Rationale

### Why [start, width] Instead of [high:low]?

We considered several alternatives from other languages:

| Language | Syntax           | Example                |
| -------- | ---------------- | ---------------------- |
| Verilog  | `[7:4]`          | High:low bit range     |
| Verilog  | `[4 +: 4]`       | Start, ascending width |
| VHDL     | `(7 downto 4)`   | High down to low       |
| Ada      | `(4..7)`         | Range with dots        |
| Rust     | `bits.get(4..8)` | Method call with range |

**Decision:** `[start, width]` because:

1. **Intuitive for C programmers** — Matches how you think about bit fields
2. **Matches shift operations** — `value >> start` shifts to position, `& ((1 << width) - 1)` masks
3. **No confusion about inclusive/exclusive** — Width is always exact
4. **Comma separator** — Clearly distinguishes from single-bit access `[n]`

### Why Not Variable Indices Initially?

```cnx
u8 flags <- 0;
u32 i <- 3;
flags[i] <- true;    // Currently generates code, but not bounds-checked
```

Variable indices are supported but not compile-time validated. Future work may add runtime bounds checking or restrict to compile-time constants for memory safety.

---

## Implementation Details

### Type Tracking

The code generator maintains a type registry:

```typescript
interface TypeInfo {
  baseType: string; // 'u8', 'u32', 'i16', etc.
  bitWidth: number; // 8, 16, 32, 64
  isArray: boolean;
  arrayLength?: number; // For arrays only
}

// Type widths
const TYPE_WIDTH: Record<string, number> = {
  u8: 8,
  i8: 8,
  u16: 16,
  i16: 16,
  u32: 32,
  i32: 32,
  u64: 64,
  i64: 64,
  f32: 32,
  f64: 64,
  bool: 1,
};
```

### Register Bit Access

Bit indexing works with register members:

```cnx
register GPIO7 @ 0x42004000 {
    DR: u32 rw @ 0x00,
}

u32 LED_BIT <- 3;
bool isOn <- GPIO7.DR[LED_BIT];   // Read bit 3 of DR register
```

**Generated C:**

```c
bool isOn = ((GPIO7_DR >> LED_BIT) & 1);
```

---

## Examples

### LED Blink with Bit Indexing

```cnx
// Create a mask using bit indexing
u32 mask <- 0;
mask[LED_BIT] <- true;        // Set the LED bit
GPIO7.DR_SET <- mask;         // Atomic write to set register
```

**Generated C:**

```c
uint32_t mask = 0;
mask = (mask & ~(1 << LED_BIT)) | ((true ? 1 : 0) << LED_BIT);
GPIO7_DR_SET = mask;
```

### Configuration Bitfields

```cnx
u8 config <- 0;
config[0, 2] <- 3;    // Mode: bits 0-1
config[2, 3] <- 5;    // Priority: bits 2-4
config[5] <- true;    // Enable: bit 5
config[6] <- false;   // Interrupt: bit 6
```

### Array Length for Loops

```cnx
u8[64] buffer;

for (u32 i <- 0; i < buffer.length; i <- i + 1) {
    buffer[i] <- 0;   // Array access (element)
}
```

### Float Bit Indexing (IEEE-754 Byte Access)

Float types (`f32`, `f64`) support bit indexing for type-safe access to their underlying IEEE-754 representation. Unlike integer bit indexing which uses direct bitwise operations, float bit indexing uses a shadow integer variable with `memcpy` to avoid undefined behavior.

```cnx
// Build an f32 from little-endian bytes
f32 value <- 0.0;
value[0, 8] <- 0x00;   // Byte 0 (LSB)
value[8, 8] <- 0x00;   // Byte 1
value[16, 8] <- 0x80;  // Byte 2
value[24, 8] <- 0x3F;  // Byte 3 (MSB) → value is now 1.0f

// Read bytes from a float
u8 highByte <- value[24, 8];  // Read MSB
```

**Generated C:**

```c
float value = 0.0;
uint32_t __bits_value;
memcpy(&__bits_value, &value, sizeof(value));
__bits_value = (__bits_value & ~(0xFFU << 0)) | (((uint32_t)0x00 & 0xFFU) << 0);
memcpy(&value, &__bits_value, sizeof(value));
// ... subsequent writes reuse __bits_value ...

// Read operation
uint8_t highByte = (memcpy(&__bits_value, &value, sizeof(value)), ((__bits_value >> 24) & 0xFFU));
```

**Type Mapping:**

| Float Type | Shadow Type | Size |
| ---------- | ----------- | ---- |
| `f32`      | `uint32_t`  | 4    |
| `f64`      | `uint64_t`  | 8    |

**Use Cases:**

- Serialization/deserialization of binary protocols
- CAN bus message encoding (J1939, etc.)
- Network byte order conversion
- Low-level IEEE-754 manipulation

### Float Bit Access vs. Integer Truncation

There are **two distinct ways** to extract bits from a float value:

| Syntax           | Behavior                               | Result for `f32 a <- 1.5`       |
| ---------------- | -------------------------------------- | ------------------------------- |
| `a[0, 8]`        | Raw IEEE-754 bytes                     | `0x00` (low byte of 0x3FC00000) |
| `((u32)a)[0, 8]` | Truncate to integer, then extract bits | `1` (integer part)              |

**Example:**

```cnx
f32 temperature <- 25.7;

// Raw IEEE-754 byte access (for binary protocols)
u8 rawByte <- temperature[0, 8];  // Some byte from IEEE-754 representation

// Integer truncation then bit extract (for numeric processing)
u8 intValue <- ((u32)temperature)[0, 8];  // 25 (truncated integer value)
```

Choose the appropriate method based on your use case:

- **Binary protocols/serialization**: Use `floatVar[offset, width]` for raw bytes
- **Numeric value extraction**: Use `((u32)floatVar)[offset, width]` for truncated integer

---

## Compile-Time Validation (Future Work)

For compile-time constant indices, the transpiler can validate:

```cnx
u8 myVar <- 0;
myVar[7] <- true;    // OK: bit 7 exists in u8
myVar[8] <- true;    // ERROR: u8 only has bits 0-7
myVar[0, 9] <- 5;    // ERROR: 9 bits exceeds u8 width
```

This is tracked as future work (compile-time validation phase).

---

## Trade-offs

### Advantages

1. **Intuitive syntax** — Integers as bit arrays is natural
2. **Type safety** — Compiler knows bit widths
3. **No runtime cost** — All operations are compile-time transforms
4. **Eliminates patterns** — No more manual mask/shift code
5. **IDE support** — `.length` enables autocomplete

### Disadvantages

1. **Verbose output** — Generated C is more complex than hand-written
2. **New syntax** — Programmers must learn `[start, width]`
3. **Limited validation** — Variable indices can't be checked at compile time

---

## Interaction with Other Features

### Register Bindings (ADR-004)

Bit indexing combines naturally with register syntax:

```cnx
register UART @ 0x40000000 {
    SR: u32 ro @ 0x00,
}

bool txEmpty <- UART.SR[7];     // Read TX empty flag
```

### Namespaces (ADR-002)

Bit operations work within namespace functions:

```cnx
namespace LED {
    void on() {
        u32 mask <- 0;
        mask[LED_BIT] <- true;
        GPIO7.DR_SET <- mask;
    }
}
```

### Array Slice Assignment (Issue #234, #1081)

The `[offset, length]` syntax has a different meaning when applied to arrays versus scalars:

| Context                | Syntax                              | Meaning                                                 |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- |
| Scalar (u8, u32, etc.) | `value[start, width]`               | Bit range manipulation                                  |
| Array (u8[], string)   | `bufArray[offset, length] <- value` | Serialize `value` into the array as little-endian bytes |

The array-slice construct is **valid** and supported. It serializes an integer `value` into consecutive array elements, least-significant byte first.

#### Superseded: `memcpy` lowering (MISRA C:2012 Rule 21.15)

Earlier versions lowered an array slice to a single `memcpy`:

```c
/* Superseded — no longer generated */
memcpy(&packetArray[0], &magic, 4);
```

This form was **superseded** (Issue #1081) for two reasons:

1. **MISRA C:2012 Rule 21.15 violation** — `memcpy` was handed incompatible pointer types: the destination was a byte buffer (`uint8_t *`) while the source was a wider integer (`uint32_t *`). Rule 21.15 requires the pointer arguments of `memcpy`/`memmove`/`memcmp` to point to compatible types.
2. **Non-deterministic byte order** — `memcpy` copied the value in the host's native byte order, so the same source produced different bytes on a big-endian target than on a little-endian target.

#### Current behavior: per-element little-endian unrolled writes

An array slice now lowers to fully-unrolled, per-element writes. Each destination element receives one slice of the source, extracted with an explicit right shift, so the bytes are written **least-significant-first (little-endian) on every target**, regardless of host endianness.

**Units (exactly as the transpiler treats them):**

- **`offset` is an element index** — `bufArray[2, 4]` begins writing at element `2`, not byte 2. For a `u8[]` an element is one byte, so the element index and the byte offset coincide; for wider arrays they differ.
- **`length` is a byte count** — the number of bytes of the source to serialize.
- Because each write stores one whole element, **`length` must be a multiple of the destination element size** (e.g. a `u16[]` slice length must be even).
- **Bounds are checked as an element span**: `offset + length / elementSize <= capacity`. An in-bounds slice at a non-zero offset into a `u16[]`/`u32[]`/`u64[]` is accepted.
- The **source is evaluated exactly once**: it is materialized into a single unsigned temporary before the writes, so an impure source such as `packetArray[0, 4] <- readSensor()` calls `readSensor()` once, not once per byte. (A single-element slice, where the value is used only once, skips the temporary.) Shifting the unsigned temporary also keeps every write MISRA C:2012 Rule 10.1-clean.

The Rule 21.15 comment is emitted whenever an equivalent `memcpy` could have passed incompatible pointer types: when the source type differs from the destination element type (the comment names the two types, e.g. `uint8_t* vs uint32_t*`), or, conservatively, when the source type cannot be resolved at compile time (a generic `destination element type vs source type`). A same-type slice such as `u32[] <- u32`, where the two pointer types would have matched, omits the comment.

**`u8[]` slice (one byte per element):**

```cnx
u8[256] packetArray;
u32 value32 <- 0x12345678;
packetArray[0, 4] <- value32;
```

Generated C:

```c
uint8_t packetArray[256] = {0};
uint32_t value32 = 0x12345678U;
/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes (memcpy would pass incompatible pointer types: uint8_t* vs uint32_t*). */
const uint32_t _tmp0 = (uint32_t)(value32);
packetArray[0] = (uint8_t)(_tmp0);
packetArray[1] = (uint8_t)(_tmp0 >> 8U);
packetArray[2] = (uint8_t)(_tmp0 >> 16U);
packetArray[3] = (uint8_t)(_tmp0 >> 24U);
```

**`u16[]` slice (element offset, whole `uint16_t` writes):**

```cnx
u16[8] wordArray;
u32 v <- 0x11223344;
wordArray[2, 4] <- v;
```

Generated C:

```c
uint16_t wordArray[8] = {0};
uint32_t v = 0x11223344U;
/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes (memcpy would pass incompatible pointer types: uint16_t* vs uint32_t*). */
const uint32_t _tmp0 = (uint32_t)(v);
wordArray[2] = (uint16_t)(_tmp0);
wordArray[3] = (uint16_t)(_tmp0 >> 16U);
```

Here `offset = 2` is an element index (writing starts at `wordArray[2]`), `length = 4` is a byte count, and because the elements are 16 bits wide the four bytes land in two `uint16_t` elements (`wordArray[2]` and `wordArray[3]`), each shifted into little-endian order.

**Issue #234: Compile-Time Safety Requirements**

Array slice assignment enforces strict compile-time safety:

1. **Offset must be a compile-time constant** — literals or `const` variables; runtime variables are rejected.
2. **Length must be a compile-time constant** — literals or `const` variables.
3. **Bounds checked at compile time** — `offset + length / elementSize <= capacity`.
4. **1D arrays only** — multi-dimensional arrays must access the innermost dimension first.
5. **Integer source only** — float and struct sources are a compile error, and the slice length may not exceed the source's width in bytes.

```cnx
// VALID: compile-time constants
packetArray[0, 4] <- magic;
packetArray[HEADER_OFFSET, 4] <- magic;  // const variable

// INVALID: runtime offset (compile error)
u32 offset <- 0;
packetArray[offset, 4] <- magic;  // ERROR: offset must be a compile-time constant

// INVALID: multi-dimensional outer dimension
u8[4][8] board;
board[0, 4] <- magic;  // ERROR: slice only valid on 1D arrays
```

**Design Rationale (Issue #272):**

The compile-time-constant requirement is a deliberate safety design choice. An earlier implementation emitted a runtime-bounds-checked `memcpy` that was _silently skipped_ when the bounds check failed, producing subtle bugs (e.g. incorrect CRC checksums from skipped writes). Two things removed that hazard:

1. **No `memcpy` at all.** The current lowering is unrolled per-element writes, so there is no `memcpy` call that can be silently skipped — the "silent skip" failure mode described in #272 is now moot.
2. **Compile-time bounds.** Requiring compile-time constants lets the element-span bound be verified before the code runs: if it compiles, it cannot overflow at runtime, which aligns with MISRA and similar safety-critical coding standards.

Runtime-dependent offsets or lengths are intentionally rejected, because the element-span bound cannot be proven at compile time.

**Named Compile-Time Offsets**

When a struct layout is fixed, the offsets are known at compile time. Use `const` variables to keep the writes readable while preserving compile-time safety:

```cnx
const size OFFSET_FIELD1 <- 0;
const size OFFSET_FIELD2 <- 4;
const size OFFSET_FIELD3 <- 6;

packetArray[OFFSET_FIELD1, 4] <- data.field1;
packetArray[OFFSET_FIELD2, 2] <- data.field2;
packetArray[OFFSET_FIELD3, 1] <- data.field3;
```

---

## Success Criteria

1. `flags[3] <- true` compiles to correct bit-set C code
2. `flags[0, 3] <- 5` compiles to correct bit-range C code
3. `buffer.length` returns array size as compile-time constant
4. `flags.length` returns bit width as compile-time constant
5. Bit access works with register members
6. blink.cnx works on Teensy MicroMod with new syntax
7. `packetArray[0, 4] <- value` generates per-element little-endian unrolled writes — one shifted byte/element write per destination element, no memcpy (Issue #234, #1081)
8. Runtime offsets in slice assignment produce compile-time errors (Issue #234)
9. Multi-dimensional array outer-dimension slicing produces compile-time errors (Issue #234)

---

## References

### Bit Manipulation in Other Languages

- [Verilog Bit-Select and Part-Select](https://www.chipverify.com/verilog/verilog-part-select)
- [VHDL Slice Notation](https://www.ics.uci.edu/~jmoorkan/vhdlref/arrays.html)
- [Ada Bit Operations](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_containers.html)
- [Rust bitvec Crate](https://docs.rs/bitvec/)
- [D Language Bit Manipulation](https://dlang.org/spec/expression.html#bit_manipulation)

### C Bit Manipulation Patterns

- [Bit Twiddling Hacks](https://graphics.stanford.edu/~seander/bithacks.html)
- [Embedded.com: Bit Manipulation](https://www.embedded.com/bit-manipulation-basics/)
- [MISRA C: Bitwise Operations](https://www.misra.org.uk/)
