# ADR-018: Unions

## Status
**Rejected**

## Context

Unions are used in embedded C for:
- Register overlays (access same memory as different types)
- Protocol parsing (interpret bytes as structured data)
- Memory-efficient variants (only one field active at a time)
- Type punning (reinterpret bits as different type)

## Decision

**C-Next will not support unions.**

Unions are rejected because:
1. They enable undefined behavior (reading inactive members)
2. They violate MISRA C guidelines for safety-critical software
3. Every use case has a safer, more explicit alternative in C-Next
4. C-Next's philosophy is "TypeScript for C" - removing footguns, not preserving them

## Rationale: The "TypeScript for C" Philosophy

C-Next is a safer front-end that generates clean C. Like TypeScript removes JavaScript footguns while compiling to JavaScript, C-Next removes C footguns while compiling to C.

From MISRA C guidelines:
> "Using unions isn't recommended in embedded and even forbidden by most of the standards and guidelines for safety software like MISRA C 2004."

Unions are exactly the kind of "clever" pattern that leads to:
- Undefined behavior (reading wrong member)
- Portability bugs (endianness, padding differences)
- MISRA violations requiring formal deviations

C-Next's value proposition:
> "You get a safe abstraction, and we generate the boring C."

## Use Cases and Alternatives

### 1. Register Overlays → ADR-004 (Implemented)

**The Problem:**
```c
// Traditional C - unions for register access
union {
    uint32_t raw;
    struct {
        uint8_t low;
        uint8_t high;
        uint16_t upper;
    } bytes;
} reg;
```

**C-Next Solution (ADR-004):**
```cnx
register GPIOB @ 0x40020400 {
    MODER: u32 rw @ 0x00,
    ODR:   u32 rw @ 0x14,
}

// Type-safe, MISRA-compliant, with access modifiers (rw/ro/wo)
GPIOB.MODER <- GPIOB.MODER | (1 << (pin * 2));
```

ADR-004 provides:
- Compile-time access control (read-only registers can't be written)
- No undefined behavior
- Clean, readable generated C
- MISRA-compliant by design

### 2. Protocol Parsing → Explicit Byte Manipulation

**The Problem (Union Approach):**
```c
// C union - type punning, undefined behavior, endianness-dependent
struct Packet {
    uint8_t type;
    union {
        uint8_t data[8];
        uint32_t errorCode;
        struct { uint16_t x; uint16_t y; } coords;
    };
};

// Nothing enforces checking type before access
Packet p;
receive(&p);
move_to(p.coords.x, p.coords.y);  // Bug if type != COORDS
```

**C-Next Solution (Explicit Parsing):**
```cnx
// Message types
const u8 MSG_DATA <- 1;
const u8 MSG_ERROR <- 2;
const u8 MSG_COORDS <- 3;

// Parse a variable-format message explicitly
void parseMessage(u8 buffer[]) {
    u8 type <- buffer[0];

    switch(type) {
        case MSG_DATA: {
            // Raw data in bytes 1-8
            processData(buffer[1], buffer[2], buffer[3], buffer[4],
                       buffer[5], buffer[6], buffer[7], buffer[8]);
        }
        case MSG_ERROR: {
            // 32-bit error code from bytes 1-4 (little endian)
            u32 errorCode <- buffer[1] as u32
                          | (buffer[2] as u32 << 8)
                          | (buffer[3] as u32 << 16)
                          | (buffer[4] as u32 << 24);
            handleError(errorCode);
        }
        case MSG_COORDS: {
            // Two 16-bit coordinates from bytes 1-4 (little endian)
            u16 x <- buffer[1] as u16 | (buffer[2] as u16 << 8);
            u16 y <- buffer[3] as u16 | (buffer[4] as u16 << 8);
            moveTo(x, y);
        }
        default: {
            handleUnknown(type);
        }
    }
}
```

**Why this is better:**
- **No undefined behavior** - just byte reads and shifts
- **Endianness is explicit** - you can see exactly how bytes become values
- **Type safety enforced** - you must check the type to know what to parse
- **Portable** - no compiler/platform-dependent union layout
- **MISRA-compliant** - no type punning

### 3. Type Punning → Forbidden

Type punning (reinterpreting bits of one type as another) is:
- Undefined behavior in C (except for `char` access)
- Explicitly forbidden by MISRA C
- A source of subtle, platform-dependent bugs

C-Next does not provide a mechanism for type punning. If you need to reinterpret bits, use explicit byte manipulation as shown above.

### 4. Memory-Efficient Variants → Explicit Design

For memory-constrained scenarios where only one "variant" is active:
- Use a byte array sized to the largest variant
- Parse/construct explicitly based on a discriminator
- The memory savings are the same; the access is safer

### 5. C Interop with Existing Union Types → ADR-010

When interfacing with existing C code that uses unions:
- Wrap the C code in an `extern` block
- Treat it as unsafe/external
- Do not expose the union type to C-Next code
- See ADR-010 for C/C++ interoperability details

## Summary

| Union Use Case | C-Next Alternative | ADR |
|----------------|-------------------|-----|
| Register overlays | `register` blocks with access modifiers | ADR-004 |
| Protocol parsing | Explicit byte manipulation | (this ADR) |
| Type punning | Forbidden - use byte manipulation | (this ADR) |
| Memory variants | Byte array + explicit parsing | (this ADR) |
| C interop | `extern` block, treat as unsafe | ADR-010 |

## References

- ADR-004: Type-Safe Register Bindings (Implemented)
- ADR-010: C/C++ Interoperability
- MISRA C:2012 - Guidelines against union usage
- [LinkedIn: Memory Mapped Registers](https://www.linkedin.com/pulse/best-way-handling-memory-mapped-registers-any-c-ahmed-nasr-eldin) - "Using unions isn't recommended in embedded"
