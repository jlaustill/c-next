# ADR-033: Packed and Aligned Structs

## Status
**Research**

## Context

Packed and aligned structs are critical for embedded:
- Hardware register layouts (no padding)
- Network protocol packets (wire format)
- Binary file formats
- Memory-mapped I/O

C uses compiler-specific pragmas or attributes.

## Decision Drivers

1. **Hardware Mapping** - Registers must match exact layout
2. **Protocols** - Binary formats can't have padding
3. **Portability** - Hide compiler-specific syntax
4. **Alignment** - Some hardware requires specific alignment

## Options Considered

### Option A: Attributes
```cnx
@packed
struct TCPHeader {
    u16 srcPort;
    u16 dstPort;
    u32 seqNum;
    u32 ackNum;
}

@align(16)
struct DMABuffer {
    u8 data[256];
}
```

### Option B: Keywords
```cnx
packed struct TCPHeader { ... }
aligned(16) struct DMABuffer { ... }
```

### Option C: Pragma Pass-through
```cnx
#pragma pack(push, 1)
struct TCPHeader { ... }
#pragma pack(pop)
```

## Recommended Decision

**Option A: Attributes** - Clean, portable, clear intent.

## Syntax

### Packed Struct
```cnx
@packed
struct EthernetFrame {
    u8 destMAC[6];
    u8 srcMAC[6];
    u16 etherType;
    u8 payload[1500];
    u32 fcs;
}
```

Generates:
```c
typedef struct __attribute__((packed)) {
    uint8_t destMAC[6];
    uint8_t srcMAC[6];
    uint16_t etherType;
    uint8_t payload[1500];
    uint32_t fcs;
} EthernetFrame;
```

### Aligned Struct
```cnx
@align(4)
struct SensorReading {
    u32 timestamp;
    i16 x;
    i16 y;
    i16 z;
}
```

Generates:
```c
typedef struct __attribute__((aligned(4))) {
    uint32_t timestamp;
    int16_t x;
    int16_t y;
    int16_t z;
} SensorReading;
```

### Combined
```cnx
@packed
@align(4)
struct DMADescriptor {
    u32 address;
    u16 length;
    u16 flags;
}
```

## Implementation Notes

### Grammar Changes
```antlr
structAttribute
    : '@packed'
    | '@align' '(' INTEGER_LITERAL ')'
    ;

structDeclaration
    : structAttribute* 'struct' IDENTIFIER '{' structMember* '}'
    ;
```

### CodeGenerator
Generate appropriate compiler attributes:
- GCC/Clang: `__attribute__((packed))`, `__attribute__((aligned(N)))`
- MSVC: `#pragma pack` (if needed)

### Priority
**High** - Critical for hardware interfaces.

## Open Questions

1. Per-member alignment? `@align(4) u32 field;`
2. Cross-compiler compatibility (GCC vs MSVC)?
3. Warn about performance impact of packed access?

## References

- GCC packed attribute
- ARM alignment requirements
- Protocol buffer layouts
