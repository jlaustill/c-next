# ADR-018: Unions

## Status
**Research**

## Context

Unions are critical in embedded C for:
- Register overlays (access same memory as different types)
- Protocol parsing (interpret bytes as structured data)
- Memory-efficient variants (only one field active at a time)
- Type punning (reinterpret bits as different type)

## Decision Drivers

1. **Hardware Access** - Register overlays are common pattern
2. **Memory Efficiency** - Important on constrained devices
3. **C Compatibility** - Must generate valid C unions
4. **Safety** - Consider optional tagging for runtime safety

## Options Considered

### Option A: C-Style Unions
```cnx
union Register {
    u32 raw;
    struct {
        u8 low;
        u8 high;
        u16 upper;
    } bytes;
}

Register r;
r.raw <- 0x12345678;
u8 lo <- r.bytes.low;
```

**Pros:** Direct C mapping, familiar
**Cons:** No safety, easy to misuse

### Option B: Tagged Unions (Rust-style)
```cnx
union Message {
    Data { u8 payload[8]; },
    Error { u32 code; },
    Ack { }
}
```

**Pros:** Type-safe, exhaustive matching
**Cons:** Complex, runtime overhead, not C-compatible

### Option C: C-Style with Warnings
Same as Option A, but compiler warns on:
- Reading field that wasn't last written
- Mixing union access patterns

**Pros:** C compatibility with safety hints
**Cons:** Can't always track at compile time

## Recommended Decision

**Option A: C-Style Unions** for v1 - Keep it simple and C-compatible.

Consider Option C warnings for v2.

## Syntax

### Basic Union
```cnx
union Converter {
    u32 asU32;
    f32 asFloat;
    u8 bytes[4];
}

Converter c;
c.asFloat <- 3.14;
u32 bits <- c.asU32;  // Type punning
```

### Register Overlay Pattern
```cnx
union USARTStatus {
    u32 raw;
    struct {
        bool txEmpty : 1;
        bool rxFull : 1;
        bool overrun : 1;
        u32 reserved : 29;
    } bits;
}
```

### Anonymous Union in Struct
```cnx
struct Packet {
    u8 type;
    union {
        u8 data[8];
        u32 value;
        struct { u16 x; u16 y; } point;
    };
}
```

## Implementation Notes

### Grammar Changes
```antlr
unionDeclaration
    : 'union' IDENTIFIER '{' unionMember+ '}'
    ;

unionMember
    : type IDENTIFIER ';'
    | structDeclaration
    ;
```

### CodeGenerator
- Generate C union typedef
- Track union types for member access
- Handle nested struct/union

## Open Questions

1. Support anonymous unions inside structs?
2. Allow bit fields inside union structs?
3. Any safety warnings for type punning?

## References

- C11 union specification
- Common embedded patterns (register overlays)
- MISRA C union guidelines
