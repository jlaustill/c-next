# ADR-045: Bounded String Type

**Status:** Accepted
**Date:** 2025-12-30
**Decision Makers:** C-Next Language Design Team

## Context

Strings in embedded C are problematic:

1. **Dynamic allocation danger** - `malloc`-based strings cause fragmentation and OOM crashes
2. **Buffer overflows** - `strcpy` and `sprintf` are notorious security vulnerabilities
3. **No length tracking** - C strings require `strlen()` which traverses the entire string
4. **Null terminator confusion** - Developers constantly forget the +1 for null byte
5. **Inconsistent patterns** - Every embedded project reinvents string handling

CNX needs a string type that is:
- **Statically allocated** - No heap, no fragmentation (aligned with ADR-003)
- **Bounded** - Maximum capacity known at compile time
- **Safe** - No buffer overflows possible
- **Ergonomic** - Better developer experience than raw `char[]`
- **Optional** - Developers can still use `u8[]` if they prefer

---

## Research: How Other Languages Handle This

### Ada: Bounded_String

Ada's standard library provides `Bounded_String` for embedded use:

```ada
-- Ada bounded string: max 80 characters, always uses 80+ bytes
declare
   Name : Bounded_String(Max_Length => 80);
begin
   Name := To_Bounded_String("Hello");  -- Stores "Hello" in 80-byte container
   Put_Line(Length(Name));              -- 5 (current length)
end;
```

> "A Bounded-Length String type always allocates memory for the maximum permitted string length for the type."
> — [AdaCore: Standard Library Strings](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_strings.html)

### Rust: heapless::String<N>

Rust's embedded ecosystem uses the `heapless` crate:

```rust
use heapless::String;

let mut s: String<64> = String::new();  // 64-byte capacity
s.push_str("Hello").unwrap();           // Returns Result (can fail if full)
println!("{}", s.len());                // 5 (current length)
println!("{}", s.capacity());           // 64 (max capacity)
```

> "All heapless data structures store their memory allocation inline and specify their capacity via their type parameter N."
> — [heapless crate documentation](https://docs.rs/heapless/latest/heapless/)

### Arduino: char[] Best Practice

Arduino documentation advises against `String` class for embedded:

```cpp
// BAD: Dynamic allocation
String name = "Hello";  // Heap allocates, causes fragmentation

// GOOD: Static char array
char name[64] = "Hello";  // Fixed memory, predictable
```

> "For these reasons you should always use character arrays (c strings) when you're using Arduino."
> — Arduino community best practices

---

## Decision

### Syntax: `string<N>`

CNX introduces a bounded string type where **N is the character capacity** (null terminator handled automatically):

```cnx
string<5> name <- "Hello";     // Holds 5 chars, transpiles to char[6]
string<256> buffer;            // Empty string, 256-char capacity
string<32> greeting <- "Hi!";  // Holds up to 32 chars
```

**Key insight:** The developer specifies character count, not byte count. CNX handles the null terminator automatically.

### Properties

| Property | Returns | Description |
|----------|---------|-------------|
| `.length` | Runtime `u32` | Current string length (character count) |
| `.capacity` | Compile-time constant | Maximum capacity (N) |

```cnx
string<64> name <- "Hello";

u32 len <- name.length;       // 5 (runtime value)
u32 cap <- name.capacity;     // 64 (compile-time constant)
```

### Generated C

```cnx
string<5> name <- "Hello";
```

Transpiles to:

```c
char name[6] = "Hello";  // 5 + 1 for null terminator
```

Property access:

```cnx
u32 len <- name.length;
u32 cap <- name.capacity;
```

Transpiles to:

```c
uint32_t len = strlen(name);  // Runtime length calculation
uint32_t cap = 5;             // Compile-time constant (character capacity)
```

---

## Detailed Design

### Declaration and Initialization

```cnx
// With initializer - capacity must fit the literal
string<13> greeting <- "Hello, World!";  // 13 chars, transpiles to char[14]

// Without initializer (empty string)
string<256> buffer;    // Initialized to "" (first byte = '\0')

// Const string with automatic sizing (no capacity needed!)
const string VERSION <- "1.0.0";  // Automatically string<5>, transpiles to char[6]
```

**Generated C:**

```c
char greeting[14] = "Hello, World!";
char buffer[257] = "";
const char VERSION[6] = "1.0.0";
```

### Const String Type Inference

For `const string` declarations with a literal initializer, the capacity is **automatically calculated**:

```cnx
const string VERSION <- "1.0.0";      // Inferred as string<5>
const string APP_NAME <- "MyApp";     // Inferred as string<5>
const string LONG_MSG <- "Hello!";    // Inferred as string<6>
```

This eliminates redundancy - you don't need to count characters for constants.

### String Literals Must Fit

String literals assigned to `string<N>` must fit within the capacity:

```cnx
string<5> ok <- "Hello";      // OK: "Hello" is exactly 5 chars
string<5> also_ok <- "Hi";    // OK: "Hi" is 2 chars, fits in 5
string<4> error <- "Hello";   // ERROR: "Hello" is 5 chars, exceeds capacity 4
```

**This is a compile-time error, not a warning.**

---

## Concatenation

CNX supports string concatenation with **compile-time capacity checking**:

```cnx
string<32> first <- "Hello";
string<32> second <- " World";
string<64> result <- first + second;  // OK: 64 >= 32 + 32
```

### Capacity-Based Safety

The destination must have capacity >= sum of source capacities:

```cnx
string<32> a <- "Hi";
string<32> b <- "There";
string<50> too_small <- a + b;  // ERROR: 50 < 32 + 32 (64 required)
string<64> just_right <- a + b; // OK: 64 >= 32 + 32
```

**Why capacity-based, not content-based?**

Even though "Hi" + "There" = 7 characters, we check against the maximum possible (32 + 32 = 64). This is **memory safe** - the destination can never overflow regardless of what's actually stored in `a` and `b` at runtime.

### Generated C

```cnx
string<64> result <- a + b;
```

Transpiles to:

```c
char result[65] = "";  // 64 + 1 for null
strncpy(result, a, 64);
strncat(result, b, 64 - strlen(result));
result[64] = '\0';
```

---

## Substring Extraction

CNX uses the same `[start, length]` syntax as bit indexing (ADR-007) for substrings:

```cnx
string<64> source <- "Hello, World!";
string<5> hello <- source[0, 5];     // "Hello" - 5 chars starting at index 0
string<6> world <- source[7, 6];     // "World!" - 6 chars starting at index 7
```

### Substring Concatenation

```cnx
string<32> a <- "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";  // 32 A's
string<32> b <- "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";  // 32 B's

// Take first half of a, second half of b
string<32> result <- a[0, 16] + b[16, 16];  // OK: 16 + 16 = 32
```

### Generated C

```cnx
string<5> hello <- source[0, 5];
```

Transpiles to:

```c
char hello[6];
strncpy(hello, source + 0, 5);
hello[5] = '\0';
```

---

## Safety Features

### Compile-Time Errors (Not Warnings)

CNX enforces strict compile-time safety. These are **errors**, not warnings:

| Situation | Error |
|-----------|-------|
| Literal too long | `ERROR: String literal "Hello" (5 chars) exceeds string<4> capacity` |
| Concatenation overflow | `ERROR: Concatenation requires capacity 64, but string<50> only has 50` |
| Assignment from larger | `ERROR: Cannot assign string<64> to string<32> (potential truncation)` |

```cnx
string<4> s <- "Hello";           // ERROR: 5 > 4
string<32> a;
string<64> b;
a <- b;                           // ERROR: potential truncation (64 > 32)
string<50> c <- a + b;            // ERROR: 32 + 64 = 96 > 50
```

### No Silent Truncation

Unlike C's `strncpy`, CNX **never silently truncates**. If data might not fit, it's a compile error.

To explicitly truncate, use substring:

```cnx
string<64> long_string <- "This is a very long string";
string<8> short <- long_string[0, 8];  // Explicit: take first 8 chars
```

---

## Comparison

String comparison uses standard `strcmp`:

```cnx
string<32> a <- "Hello";
string<64> b <- "Hello";

if (a == b) {      // strcmp(a, b) == 0
    // Equal content
}

if (a != b) {      // strcmp(a, b) != 0
    // Different content
}
```

---

## Optional Feature

**Important:** The `string` type is completely optional in CNX. Developers are free to continue using `u8[]` for string handling if they prefer:

```cnx
// Using string type (recommended)
string<64> message <- "Hello";

// Using u8 array (also valid)
u8 message[65] <- "Hello";  // Must manually account for null terminator
```

The `string` type provides safety and ergonomics, but `u8[]` remains available for:
- Legacy code compatibility
- Manual memory layout control
- Interop with specific C APIs

---

## Interaction with Other Features

### Null State (ADR-015)

Strings are never null in CNX - they're always valid arrays:

```cnx
string<64> name;    // Empty string "", not null
```

### C Interoperability (ADR-010)

Strings can be passed to C functions expecting `char*` or `const char*`:

```cnx
string<64> message <- "Hello";
printf("%s\n", message);        // Works: string<N> is a char[]
```

### Const Qualifier (ADR-013)

```cnx
const string VERSION <- "1.0.0";   // Immutable, auto-sized
```

Transpiles to:

```c
const char VERSION[6] = "1.0.0";
```

### Arrays of Strings

```cnx
string<32> names[10];    // Array of 10 strings, each up to 32 chars
```

Transpiles to:

```c
char names[10][33];  // 32 + 1 for null terminator each
```

---

## Trade-offs

### Advantages

1. **No heap allocation** - Memory usage known at compile time
2. **Safe by default** - No buffer overflows, no silent truncation
3. **Null terminator handled** - Developer specifies chars, not bytes
4. **Familiar syntax** - Generic-style `string<N>` is intuitive
5. **C compatible** - Just a `char[]` underneath
6. **Ergonomic** - `.length` and `.capacity` properties
7. **Const inference** - No need to count chars for constants
8. **Optional** - Can still use `u8[]` if preferred

### Disadvantages

1. **Memory overhead** - Always allocates max capacity + 1
2. **Fixed size** - Cannot grow beyond capacity
3. **Runtime length** - `.length` requires `strlen()` call
4. **Strict errors** - May require explicit substring for truncation

### Why Not Track Length at Runtime?

Some languages store length alongside the string:

```c
struct String {
    char data[N];
    size_t length;
};
```

We chose not to for:
1. **C compatibility** - `char[]` works with all C functions
2. **Simplicity** - No struct overhead
3. **Memory** - Saves a `size_t` per string
4. **Predictability** - Matches what embedded developers expect

The trade-off is that `.length` requires calling `strlen()`.

---

## Implementation Notes

### Grammar Changes

Add `string` as a type with optional generic capacity:

```antlr
type
    : primitiveType
    | 'string' '<' INTEGER '>'    // Sized string
    | 'string'                    // For const with inference
    | customType
    ;
```

### Code Generator Changes

1. Detect `string<N>` type declarations
2. Generate `char name[N+1]` for declarations (add 1 for null)
3. For `const string` with literal, infer N from literal length
4. Generate `strncpy()` + null termination for assignments
5. Generate `strlen()` for `.length` access
6. Generate compile-time constant N for `.capacity`
7. Validate concatenation: dest.capacity >= src1.capacity + src2.capacity
8. Validate assignment: dest.capacity >= src.capacity
9. Generate substring extraction with bounds checking

### Required C Headers

```c
#include <string.h>   // For strlen, strncpy, strncat, strcmp
```

---

## Success Criteria

1. `string<5> s <- "Hello"` transpiles to `char s[6] = "Hello"`
2. `.length` returns current string length via `strlen()`
3. `.capacity` returns compile-time constant N (character count)
4. Literal overflow is a **compile error**
5. Truncation on assignment is a **compile error**
6. Concatenation capacity mismatch is a **compile error**
7. `const string X <- "lit"` auto-sizes to literal length
8. Substring `s[start, len]` extracts substring safely
9. Strings work with C standard library functions
10. No heap allocation ever
11. `u8[]` remains available as alternative

---

## Future Work

- **String formatting** - `string.format()` or similar
- **Unicode considerations** - Currently assumes ASCII/single-byte
- **String methods** - `.trim()`, `.upper()`, `.lower()`, etc.

---

## References

- ADR-003: Static Memory Allocation - Research on bounded strings in Ada, Rust
- ADR-007: Type-Aware Bit Indexing - Substring syntax inspiration `[start, length]`
- [Ada Bounded_String](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_strings.html)
- [Rust heapless::String](https://docs.rs/heapless/latest/heapless/struct.String.html)
- [MISRA C string handling guidelines](https://www.misra.org.uk/)
- [Arduino String class problems](https://arduino.stackexchange.com/questions/1013/how-do-i-split-an-incoming-string)
- [Feabhas: Working with Strings in Embedded C++](https://blog.feabhas.com/2022/02/working-with-strings-in-embedded-c/)
