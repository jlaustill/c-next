# ADR-058: Explicit Length Properties (`bit_length`, `byte_length`)

## Status

**Implemented**

## Related

- [ADR-007: Type-Aware Bit Indexing](adr-007-type-aware-bit-indexing.md) (introduces `.length`)
- [ADR-023: Sizeof](adr-023-sizeof.md) (type/value size queries)
- [ADR-044: Primitive Types](adr-044-primitive-types.md) (TYPE_WIDTH registry)
- [ADR-045: Bounded Strings](adr-045-string-type.md) (`.length`, `.capacity`, `.size`)

## Context

C-Next currently uses `.length` as a universal property on multiple types, but it means different things depending on the type:

| Type                       | `.length` returns       | Compile-time? | Example                        |
| -------------------------- | ----------------------- | ------------- | ------------------------------ |
| `u32 counter`              | 32 (bit width)          | Yes           | `counter.length` → `32`        |
| `u8[16] buffer`            | 16 (element count)      | Yes           | `buffer.length` → `16`         |
| `string<64> name`          | Runtime character count | **No**        | `name.length` → `strlen(name)` |
| `u32[10] arr` via `arr[0]` | 32 (element bit width)  | Yes           | `arr[0].length` → `32`         |

This overloading means that reading `someVar.length` requires knowing the type of `someVar` to understand what the value represents. This is exactly the class of ambiguity that has caused well-documented problems in other languages.

### The Ambiguity Problem

Consider this C-Next code:

```cnx
u32 x <- someVar.length;
```

Without knowing `someVar`'s type, this could be:

- **16** — the number of elements (if `someVar` is `u8[16]`)
- **32** — the bit width (if `someVar` is `u32`)
- **5** — the current string length at runtime (if `someVar` is `string<64>` containing "Hello")

A developer reading unfamiliar code, reviewing a PR, or debugging at 3 AM should not need to trace type information to understand what `.length` means.

### Additional Motivation: User-Defined Length

Beyond the ambiguity of built-in types, users reasonably want `.length` as a member name in their own structs and scopes:

```cnx
struct Packet {
    u8[256] data;
    u32 length;      // How many bytes are actually used
}
```

Currently, `.length` as a struct field name collides with the built-in property (Issue #212 added special disambiguation logic). Renaming the built-in properties frees `.length` for user code.

---

## Research: How Other Languages Handle This

### Languages with Ambiguous `.length` (Problematic)

**JavaScript** — `.length` means three different things:

- Array `.length`: element count
- String `.length`: UTF-16 code unit count (NOT characters — `"💩".length === 2`)
- Function `.length`: formal parameter count

This has caused [countless bugs](https://hsivonen.fi/string-length/) in input validation, database sizing, and text truncation. Notably, JavaScript's binary APIs use **explicit naming**: `ArrayBuffer.byteLength`, `TypedArray.byteLength` — these are never ambiguous.

**Java** — Three inconsistent APIs for the same concept:

- `int[].length` (field, no parentheses)
- `String.length()` (method)
- `List.size()` (method)

This inconsistency [is considered a historical mistake](https://www.geeksforgeeks.org/java/length-vs-length-java/) that cannot be fixed without breaking backward compatibility.

**Go** — `len()` returns bytes for strings but elements for slices. The [Go Blog](https://go.dev/blog/strings) explicitly documents this, and [GitHub issue #22127](https://github.com/golang/go/issues/22127) shows users regularly confused by it.

### Languages with Explicit Naming (Effective)

**Rust** — Systematic separation:

- `T::BITS` — bit width of integer types (e.g., `u32::BITS == 32`)
- `.len()` — element count for collections
- `std::mem::size_of::<T>()` — byte size of a type

**Ada** — The gold standard for safety-critical naming:

- `'Size` — bits needed for the type
- `'Length` — element count (arrays only, never integers)
- `'Component_Size` — bits per element
- `'Object_Size` — actual storage bits including padding

Ada's `'Length` is unambiguous because it only applies to arrays.

**Zig** — Explicit builtins:

- `@bitSizeOf(T)` — bits (no padding)
- `@sizeOf(T)` — bytes (with padding)
- `array.len` — element count

The distinction between `@sizeOf` and `@bitSizeOf` has been [a source of confusion](https://ziggit.dev/t/inconsistent-sizeof-vs-bitsizeof/6264) in the Zig community, particularly with packed structs — demonstrating that even in well-designed systems languages, the bit/byte distinction matters.

**Elixir/Erlang** — Perhaps the most relevant precedent:

- `bit_size(binary)` — total bits
- `byte_size(binary)` — total bytes
- `String.length(s)` — grapheme count

This is a deliberate design choice. The unit is always in the name.

**Python** — Explicit method naming:

- `len(obj)` — element/character count
- `int.bit_length()` — minimum bits to represent the value
- `sys.getsizeof(obj)` — byte size

Python's `int.bit_length()` uses the exact `bit_length` naming pattern proposed here.

**Swift** — No `.length` at all:

- `.count` — user-perceived character count for strings, element count for arrays
- `.utf8.count` — UTF-8 code units
- `.utf16.count` — UTF-16 code units

Swift deliberately chose `.count` over `.length` because there is no single correct "length" for a string.

**Ruby** — Explicit byte distinction:

- `.length` / `.size` — character count
- `.bytesize` — byte count

`.bytesize` was specifically added because `.length` was insufficient for multi-byte encodings.

### The Pattern

Languages that put the unit in the property name have the fewest bugs and the least confusion:

| Language            | Bit property | Byte property | Element count    |
| ------------------- | ------------ | ------------- | ---------------- |
| Elixir              | `bit_size`   | `byte_size`   | `length`         |
| JavaScript (binary) | —            | `byteLength`  | `length`         |
| .NET                | —            | `ByteLength`  | `Count`/`Length` |
| Python              | `bit_length` | —             | `len()`          |
| Rust                | `T::BITS`    | `size_of`     | `len()`          |
| Zig                 | `@bitSizeOf` | `@sizeOf`     | `.len`           |
| Ada                 | `'Size`      | —             | `'Length`        |

### Safety Standards Perspective

**CERT C** documents multiple rule categories caused by size/length confusion:

- ARR01-C: Don't apply sizeof to a pointer when taking array size
- STR31-C: Don't confuse buffer size with string length
- MEM35-C: Allocate sufficient memory (sizeof confusion)

**DO-178C** (avionics certification) requires "unambiguous syntax" with "definite naming conventions." SPARK Ada achieves this through its explicit attribute system.

**MISRA Directive 4.6** recommends fixed-width types to make sizes unambiguous — the same principle applies to property names.

---

## Proposal

Remove `.length` from all built-in types entirely. Replace with explicit, unit-in-the-name properties where every property tells you exactly what it returns.

### New Property System

| Property         | Applies to                      | Returns                                              | Compile-time? | Generated C          |
| ---------------- | ------------------------------- | ---------------------------------------------------- | ------------- | -------------------- |
| `.bit_length`    | Integers, bitmaps, enums, bools | Bit width of the type                                | Yes           | Constant             |
| `.bit_length`    | Arrays                          | Total bits of storage (elements × element bit width) | Yes           | Constant             |
| `.bit_length`    | Strings                         | Total buffer bits (`.size × 8`)                      | Yes           | Constant             |
| `.bit_length`    | Structs                         | Total struct size in bits                            | Yes           | Constant             |
| `.byte_length`   | All types above                 | `.bit_length / 8`                                    | Yes           | Constant             |
| `.element_count` | Arrays                          | Number of elements (first dimension)                 | Yes           | Constant             |
| `.element_count` | Structs                         | Number of fields                                     | Yes           | Constant             |
| `.char_count`    | Strings                         | Current character count                              | No            | `strlen()`           |
| `.capacity`      | Strings                         | Maximum character capacity                           | Yes           | Constant (unchanged) |
| `.size`          | Strings                         | Buffer size (capacity + 1)                           | Yes           | Constant (unchanged) |

### Design Principle

**`.length` is completely removed from all built-in types.** This:

- Eliminates all ambiguity — every property name contains its unit
- Frees `.length` for user-defined struct fields and scope members
- Removes the Issue #212 disambiguation hack entirely
- Uses `snake_case` so users can still use `camelCase` (e.g., `bitLength`) in their own code

### Scalar Type Examples

```cnx
// Before (ambiguous)
u32 flags <- 0;
u32 x <- flags.length;          // 32... but 32 what?

// After (explicit)
u32 flags <- 0;
u32 bits <- flags.bit_length;   // 32 — unambiguous
u32 bytes <- flags.byte_length; // 4 — also available

// Works on all scalar types
bool active <- true;
u32 b <- active.bit_length;     // 8

enum EState { IDLE, RUNNING, STOPPED }
EState s <- EState.IDLE;
u32 e <- s.bit_length;          // 32
```

### Array Examples

Arrays get all three properties — total storage size AND element count:

```cnx
u32[16] buffer;
u32 bits <- buffer.bit_length;        // 512  (16 × 32)
u32 bytes <- buffer.byte_length;      // 64   (512 / 8)
u32 count <- buffer.element_count;    // 16

u8[256] data;
u32 bits2 <- data.bit_length;        // 2048 (256 × 8)
u32 bytes2 <- data.byte_length;      // 256  (2048 / 8)
u32 count2 <- data.element_count;    // 256
```

### Multi-Dimensional Array Examples

Properties work recursively through each dimension:

```cnx
u8[8][8] matrix;

// Full array: 8 × 8 × 8 bits
u32 total <- matrix.bit_length;       // 512
u32 bytes <- matrix.byte_length;      // 64
u32 rows <- matrix.element_count;     // 8

// One row: 8 × 8 bits
u32 row_bits <- matrix[0].bit_length;       // 64
u32 row_bytes <- matrix[0].byte_length;     // 8
u32 cols <- matrix[0].element_count;        // 8

// Single element: 8 bits
u32 elem_bits <- matrix[0][0].bit_length;   // 8
u32 elem_bytes <- matrix[0][0].byte_length; // 1
```

### String Examples

```cnx
string<64> name <- "Hello";

u32 bits <- name.bit_length;      // 520  (65 × 8, actual buffer including null terminator)
u32 bytes <- name.byte_length;    // 65   (actual buffer size, same as .size)
u32 chars <- name.char_count;     // 5    (runtime strlen)
u32 cap <- name.capacity;         // 64   (unchanged — max usable characters)
u32 sz <- name.size;              // 65   (unchanged — capacity + 1)
```

Note: `byte_length` and `.size` return the same value for strings. Both exist because `byte_length` is the universal storage-size property (works on all types), while `.size` is the string-specific buffer size property (ADR-045).

### Struct Examples

```cnx
struct SensorReading {
    u32 timestamp;
    f32 temperature;
    u16 humidity;
    u8 status;
}

SensorReading reading;
u32 bits <- reading.bit_length;        // struct size in bits
u32 bytes <- reading.byte_length;      // struct size in bytes (with padding)
u32 fields <- reading.element_count;   // 4 (number of fields)
```

Struct size properties are invaluable for memory safety in v2 scenarios:

```cnx
// Dynamic memory (ADR-101, v2)
SensorReading[100] readings;
u32 total_bytes <- readings.byte_length;   // Total buffer size for DMA transfer

// Thread-safe shared memory (ADR-100, v2)
u32 struct_size <- reading.byte_length;    // Size for memcpy in IPC
```

### User-Defined `.length` Now Works

```cnx
// No collision with built-in properties
struct Packet {
    u8[256] data;
    u32 length;             // Perfectly fine now
}

scope Buffer {
    u8[1024] data;
    u32 length <- 0;        // Track used bytes — no conflict

    void append(u8 byte) {
        this.data[this.length] <- byte;
        this.length +<- 1;
    }
}
```

### Bit Indexing Interaction

The bit indexing feature (ADR-007) remains unchanged. The `[start, width]` syntax operates on bits regardless of the property name:

```cnx
u32 flags <- 0;
flags[0, 4] <- 5;                  // Set 4 bits starting at bit 0
u32 width <- flags.bit_length;     // 32 — how many bits flags has
```

The rename improves readability — `flags.bit_length` makes it obvious that the value relates to the bit indexing system.

### `memcpy` Slice Interaction

`byte_length` is directly useful for slice assignments (ADR-007, Issue #234):

```cnx
u8[256] buffer;
u32 magic <- 0x12345678;

// Before: had to manually calculate byte size
buffer[0, 4] <- magic;

// After: byte_length makes intent clear in documentation/comments
// magic.byte_length is 4, so this copies 4 bytes
buffer[0, magic.byte_length] <- magic;
```

---

## Options Considered

### Option A: `bit_length` + `byte_length` + `element_count` + `char_count` (Selected)

Complete replacement of `.length` with explicit properties.

**Pros:**

- Follows Python's `int.bit_length()` and Elixir's `bit_size`/`byte_size` precedent
- Unit is always in the name — zero ambiguity on any type
- `.length` completely freed for user code
- `byte_length` directly useful for `memcpy` calculations
- `snake_case` leaves `camelCase` available for user identifiers
- Recursive array semantics are intuitive (`arr.bit_length` = total storage)
- `element_count` is unambiguous — cannot be confused with bit or byte counts

**Cons:**

- Breaking change for all existing `.length` usage
- Longer property names than `.length`
- Four new properties to learn (though each is self-explanatory)

### Option B: `bit_width` + `byte_size`

Use "width" for bits and "size" for bytes, following hardware terminology.

**Pros:**

- "Bit width" is standard hardware terminology
- Shorter than `bit_length`/`byte_length`

**Cons:**

- Mixes terminology (`width` vs `size`) — less consistent
- `.size` already exists on strings (ADR-045) with a different meaning (capacity + 1)
- "Width" doesn't naturally extend to arrays (what's the "width" of an array?)

### Option C: `bits` + `bytes` (Rust-inspired)

Ultra-short property names following Rust's `T::BITS` pattern.

**Pros:**

- Very concise: `flags.bits` → `32`, `flags.bytes` → `4`

**Cons:**

- Could be confused with the actual bit/byte values rather than the count
- `bytes` on a `u8` could mean "the raw bytes" vs "number of bytes"
- No natural array element count property in this scheme

### Option D: Non-breaking deprecation

Keep `.length` working everywhere but add new properties alongside.

**Cons:**

- Ambiguity remains during deprecation period
- "Helpful, not burdensome" principle — deprecation warnings add noise
- C-Next is pre-1.0; now is the time for breaking changes

---

## Migration Impact

### Affected Code Patterns

Based on the test suite, **every** current `.length` usage changes:

| Current Pattern                         | New Pattern              | Files Affected |
| --------------------------------------- | ------------------------ | -------------- |
| `intVar.length`                         | `intVar.bit_length`      | ~30 test files |
| `bitmapVar.length`                      | `bitmapVar.bit_length`   | ~5 test files  |
| `enumVar.length`                        | `enumVar.bit_length`     | ~2 test files  |
| `boolVar.length`                        | `boolVar.bit_length`     | ~1 test file   |
| `arr[i].length` (element type width)    | `arr[i].bit_length`      | ~3 test files  |
| `structField.length` (field type width) | `structField.bit_length` | ~4 test files  |
| `arrayVar.length` (element count)       | `arrayVar.element_count` | ~11 test files |
| `stringVar.length` (strlen)             | `stringVar.char_count`   | ~2 test files  |
| `args.length` (argc)                    | `args.element_count`     | ~1 test file   |

### Error Message Support

The transpiler should emit a helpful error when `.length` is used on any built-in type:

```
error: `.length` is not a built-in property. Use explicit properties instead.
  --> file.cnx:10:20
   |
10 |     u32 bits <- flags.length;
   |                       ^^^^^^
   |
   = help: for bit width, use `.bit_length`
   = help: for byte width, use `.byte_length`
```

For arrays:

```
error: `.length` is not a built-in property. Use explicit properties instead.
  --> file.cnx:12:22
   |
12 |     u32 count <- buffer.length;
   |                         ^^^^^^
   |
   = help: for element count, use `.element_count`
   = help: for total bits of storage, use `.bit_length`
   = help: for total bytes of storage, use `.byte_length`
```

---

## Resolved Questions

1. **`args` in `main()`**: `args` is an array, so `args.element_count` maps to `argc`. Consistent with all other arrays.

2. **String `bit_length`/`byte_length` semantics**: Uses `.size` semantics (actual buffer storage including null terminator). For `string<64>`: `bit_length` = 520 (65 × 8), `byte_length` = 65. This matches the principle that `bit_length`/`byte_length` always report actual storage, which is what you need for `memcpy`, DMA transfers, etc.

3. **Structs get all applicable properties**: `bit_length`, `byte_length` (total struct size including padding), and `element_count` (number of fields). These will be invaluable for v2 dynamic memory (ADR-101) and multi-core synchronization (ADR-100) where knowing exact struct sizes at compile time is critical for safe memory operations.

4. **Naming convention**: `snake_case` (`bit_length`, `byte_length`, `element_count`, `char_count`) so that users can still use `camelCase` (e.g., `bitLength`, `byteLength`) in their own struct fields and scope members without collision.

5. **Arrays**: `arr.bit_length` returns total storage (elements × element bit width), not just element count. `arr[i].bit_length` returns the element type's bit width. Multi-dimensional arrays work recursively: `u8[8][8].bit_length` = 512, `[0].bit_length` = 64, `[0][0].bit_length` = 8.

6. **Enums**: Yes, enums get `bit_length` (32) and `byte_length` (4).

## Open Questions

1. **Struct padding**: Should `bit_length`/`byte_length` on structs report the size with or without C struct padding? With padding matches `sizeof()` (what you'd use for `memcpy`), but without padding matches the sum of field sizes. The `sizeof` interpretation is more useful and matches what C does.

2. **Nested struct arrays**: For `struct Outer { Inner[10] items; }`, should `outer.items.element_count` return 10? This follows naturally from the array rules, but the implementation needs to handle struct field type resolution.

---

## References

### Language Documentation

- [Rust `u32::BITS`](https://doc.rust-lang.org/std/primitive.u32.html)
- [Python `int.bit_length()`](https://python-reference.readthedocs.io/en/latest/docs/ints/bit_length.html)
- [Elixir `bit_size`/`byte_size`](https://hexdocs.pm/elixir/binaries-strings-and-charlists.html)
- [Zig `@bitSizeOf`/`@sizeOf`](https://ziglang.org/documentation/master/)
- [Ada `'Size`/`'Length` attributes](https://en.wikibooks.org/wiki/Ada_Programming/Attributes)
- [Swift String docs](https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html)
- [MDN `ArrayBuffer.byteLength`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)

### Bug Patterns

- [JavaScript string length confusion](https://hsivonen.fi/string-length/)
- [Java length vs length() vs size()](https://www.geeksforgeeks.org/java/length-vs-length-java/)
- [Zig @sizeOf vs @bitSizeOf confusion](https://ziggit.dev/t/inconsistent-sizeof-vs-bitsizeof/6264)
- [C++ size_t underflow bugs](https://medium.com/@tomsvoj/why-size-t-can-cause-bugs-in-c-and-how-to-fix-them-c288c9d6c1d1)

### Safety Standards

- [CERT ARR01-C: sizeof on array pointers](https://wiki.sei.cmu.edu/confluence/display/c/ARR01-C.+Do+not+apply+the+sizeof+operator+to+a+pointer+when+taking+the+size+of+an+array)
- [CERT STR31-C: Buffer size vs string length](https://wiki.sei.cmu.edu/confluence/display/c/STR31-C.+Guarantee+that+storage+for+strings+has+sufficient+space+for+character+data+and+the+null+terminator)
- [MISRA C Guidelines](https://www.embedded.com/how-misra-c-guidelines-enhance-code-safety-reduce-risks/)
- [Barr Group: Top 10 Firmware Bugs](https://barrgroup.com/embedded-systems/how-to/top-ten-nasty-firmware-bugs)
