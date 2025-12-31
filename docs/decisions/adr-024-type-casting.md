# ADR-024: Type Casting

## Status
**Implemented**

## Context

Type casting in C is a major source of bugs and security vulnerabilities. CNX takes a strict approach: **widening is safe, narrowing is dangerous**.

### The Problem with C Casts

```c
uint32_t large = 1000;
uint8_t byte = (uint8_t)large;  // Silently truncates to 232!

int32_t signed_val = -5;
uint32_t unsigned_val = (uint32_t)signed_val;  // Becomes 4294967291!
```

These silent data losses cause real security vulnerabilities.

---

## Research: Casting Bugs and Vulnerabilities

### CWE Classifications

| CWE | Name | Description |
|-----|------|-------------|
| [CWE-681](https://cwe.mitre.org/data/definitions/681.html) | Incorrect Conversion between Numeric Types | Converting a value to a type that cannot represent it |
| [CWE-195](https://cwe.mitre.org/data/definitions/195.html) | Signed to Unsigned Conversion Error | Negative values become large positive values |
| [CWE-196](https://cwe.mitre.org/data/definitions/196.html) | Unsigned to Signed Conversion Error | Large values become negative |

### Real-World Vulnerabilities

**CVE-2025-30646 (Juniper Networks):** A signed-to-unsigned conversion error in the Layer 2 Control Protocol daemon allowed unauthenticated attackers to crash and restart the l2cpd process via malformed LLDP packets.

**SSHD Casting Vulnerability:** Port was defined as signed int but `sin_port` was unsigned short. Negative values subverted error checks while still assigning privileged ports below 1024.

**Dell BIOS (DSA-2023-176):** Signed-to-unsigned conversion error could be exploited to compromise the system.

> "It is dangerous to rely on implicit casts between signed and unsigned numbers because the result can take on an unexpected value and violate assumptions made by the program."
> — [CWE-195](https://cwe.mitre.org/data/definitions/195.html)

### Buffer Overflow via Truncation

> "If a variable like `numHeaders` is defined as a signed int, it could be negative. If the incoming packet specifies a value such as -3, then the malloc calculation will generate a negative number. When converted to `size_t`, this produces a large value like 4294966996, potentially leading to a buffer overflow."
> — [InformIT: Type Conversion Vulnerabilities](https://www.informit.com/articles/article.aspx?p=686170&seqNum=6)

### MISRA C Guidelines

MISRA C has extensive rules about type conversions:

- **Rule 10.3**: "The value of an expression shall not be assigned to an object with a narrower essential type or of a different essential type category"
- **Rule 10.4**: "Both operands of an operator shall have the same essential type category"
- **Rule 10.5**: Avoid casting non-Boolean values to Boolean

> "ISO C may be considered to exhibit poor type safety as it permits a wide range of implicit type conversions to take place. These type conversions can compromise safety."
> — [SPARK for the MISRA C Developer](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/04_strong_typing.html)

---

## Decision

CNX eliminates dangerous casts by design:

1. **Widening conversions**: Implicit (always safe)
2. **Narrowing conversions**: **Compiler error** - use bit indexing instead
3. **Signed/unsigned conversions**: **Compiler error** - be explicit about intent

### Widening Conversions (Implicit, Safe)

Widening never loses data, so it's allowed implicitly:

```cnx
u8 byte <- 42;
u32 wide <- byte;      // OK: u8 → u32 is safe (implicit)
i16 small <- 100;
i32 large <- small;    // OK: i16 → i32 is safe (implicit)
```

**Generated C:**
```c
uint8_t byte = 42;
uint32_t wide = byte;      // Implicit widening
int16_t small = 100;
int32_t large = small;     // Implicit widening
```

### Narrowing Conversions (Error - Use Bit Indexing)

Narrowing can lose data, so CNX **forbids casts** and requires **bit indexing** instead:

```cnx
u32 large <- 1000;
u8 byte <- (u8)large;      // ERROR: Narrowing cast forbidden

// Instead, use bit indexing to be explicit about which bits you want:
u8 lowByte <- large[0, 8];    // Take bits 0-7 (least significant byte)
u8 highByte <- large[24, 8];  // Take bits 24-31 (most significant byte)
```

**Why bit indexing?**
- **Explicit**: Developer states exactly which bits are kept
- **Intentional**: No accidental truncation
- **Self-documenting**: `large[0, 8]` clearly means "low 8 bits"

**Generated C:**
```c
uint32_t large = 1000;
uint8_t lowByte = (large >> 0) & 0xFF;   // Bits 0-7
uint8_t highByte = (large >> 24) & 0xFF; // Bits 24-31
```

### Signed/Unsigned Conversions (Error)

Converting between signed and unsigned is dangerous:

```cnx
i32 signed_val <- -5;
u32 unsigned_val <- (u32)signed_val;  // ERROR: Sign conversion forbidden

u32 large_unsigned <- 4000000000;
i32 as_signed <- (i32)large_unsigned; // ERROR: Sign conversion forbidden
```

If you truly need this conversion, use bit indexing to acknowledge the risk:

```cnx
i32 signed_val <- -5;
u32 as_bits <- signed_val[0, 32];  // Explicit: treat as 32 bits
```

### Boolean Extraction (Use Bit Indexing)

In C, you might write:
```c
bool bit = (bool)((flags >> 3) & 1);
```

In CNX, use the bit indexing syntax (ADR-007):
```cnx
bool bit <- flags[3];  // Much cleaner!
```

---

## What CNX Does NOT Support

### No Pointer/Address Casts

CNX does not support casting integers to pointers or vice versa:

```cnx
u32 rawAddr <- 0x40000000;
volatile u32 reg <- (volatile u32)rawAddr;  // NOT SUPPORTED
```

**Why?** For hardware register access, use the `register` keyword (ADR-004):

```cnx
register GPIO @ 0x40000000 {
    DR: u32 rw @ 0x00,
}

GPIO.DR <- 0xFF;  // Safe, typed register access
```

### No Reinterpret Casts

CNX does not support reinterpreting memory as a different type:

```cnx
f32 floatVal <- 3.14;
u32 bits <- (u32)floatVal;  // NOT SUPPORTED as bit reinterpret
```

If this is needed in the future, it would require a separate, explicit mechanism.

---

## Summary of Cast Rules

| Conversion | CNX Behavior | Rationale |
|------------|--------------|-----------|
| u8 → u32 (widen) | Implicit | No data loss possible |
| i8 → i32 (widen) | Implicit | No data loss possible |
| u32 → u8 (narrow) | **Error** - use `val[0, 8]` | Potential data loss |
| i32 → u32 (sign change) | **Error** - use `val[0, 32]` | Sign semantics change |
| u32 → i32 (sign change) | **Error** - use `val[0, 32]` | Sign semantics change |
| int → pointer | **Not supported** | Use `register` (ADR-004) |
| f32 → u32 (reinterpret) | **Not supported** | Future consideration |

---

## Implementation Notes

### Grammar Changes

Casts are primarily removed from the language. Bit indexing (ADR-007) handles narrowing:

```antlr
// No cast expression needed - widening is implicit
// Narrowing uses existing bit indexing: expr '[' start ',' width ']'
```

### CodeGenerator

1. Detect widening conversions → generate implicit C conversion
2. Detect narrowing conversions → emit compiler error with suggestion
3. Detect sign conversions → emit compiler error with suggestion

### Error Messages

```
ERROR: Cannot narrow u32 to u8 (potential data loss)
  --> src/main.cnx:10:5
   |
10 | u8 byte <- (u8)large;
   |            ^^^^^^^^^
   |
   = help: Use bit indexing to specify which bits: large[0, 8]
```

```
ERROR: Cannot convert i32 to u32 (sign change)
  --> src/main.cnx:15:5
   |
15 | u32 x <- (u32)signed_val;
   |          ^^^^^^^^^^^^^^^
   |
   = help: Use bit indexing to reinterpret: signed_val[0, 32]
```

---

## Trade-offs

### Advantages

1. **No silent truncation** - Data loss is impossible without explicit bit indexing
2. **No sign conversion bugs** - Signed/unsigned confusion eliminated
3. **Self-documenting** - `large[0, 8]` is clearer than `(u8)large`
4. **MISRA compliant** - Satisfies Rules 10.3, 10.4, 10.5
5. **Security** - Eliminates entire classes of vulnerabilities (CWE-195, CWE-196, CWE-681)

### Disadvantages

1. **More verbose** - `large[0, 8]` vs `(u8)large`
2. **Learning curve** - C programmers expect casts to work
3. **Migration effort** - Existing C patterns need rewriting

---

## Success Criteria

1. Widening conversions (u8 → u32, etc.) work implicitly
2. Narrowing conversions produce compiler error with helpful message
3. Sign conversions produce compiler error with helpful message
4. Bit indexing provides explicit alternative for all narrowing needs
5. No pointer/address casts supported (use ADR-004 registers)

---

## References

### Vulnerability Research
- [CWE-681: Incorrect Conversion between Numeric Types](https://cwe.mitre.org/data/definitions/681.html)
- [CWE-195: Signed to Unsigned Conversion Error](https://cwe.mitre.org/data/definitions/195.html)
- [CWE-196: Unsigned to Signed Conversion Error](https://cwe.mitre.org/data/definitions/196.html)
- [InformIT: Type Conversion Vulnerabilities](https://www.informit.com/articles/article.aspx?p=686170&seqNum=6)
- [Feabhas: When Integers Go Bad](https://blog.feabhas.com/2014/10/vulnerabilities-in-c-when-integers-go-bad/)

### MISRA C Guidelines
- [SPARK for the MISRA C Developer: Enforcing Strong Typing](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/04_strong_typing.html)
- [PVS-Studio: V2572 - Narrowing Essential Type](https://pvs-studio.com/en/docs/warnings/v2572/)
- [MISRA C 2012 Rules Explained](https://www.codeant.ai/blogs/misra-c-2012-rules-examples-pdf)

### Related ADRs
- ADR-004: Register Bindings (for hardware access instead of pointer casts)
- ADR-007: Type-Aware Bit Indexing (for explicit bit extraction)
- ADR-044: Primitive Types (for overflow handling with clamp/wrap)
