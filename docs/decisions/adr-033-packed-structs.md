# ADR-033: Packed and Aligned Structs

## Status

**Rejected**

## Context

Packed and aligned structs are sometimes requested for embedded:

- Hardware register layouts (no padding)
- Network protocol packets (wire format)
- Binary file formats
- Memory-mapped I/O

C uses compiler-specific pragmas or attributes (`__attribute__((packed))`).

## Decision

**Rejected.** C-Next does not provide packed struct syntax.

### Rationale

1. **No genuine requirement** — All use cases have safer alternatives
2. **ADR-004 covers hardware** — Register bindings handle memory-mapped I/O with explicit offsets
3. **Serialization is safer** — Network protocols should use explicit encode/decode functions
4. **Safety hazards** — ARM Cortex-M0 crashes on unaligned access; MISRA requires formal deviations
5. **Field reordering works** — Memory savings achievable without alignment penalties

### Alternatives for Each Use Case

| Use Case            | C-Next Solution                           |
| ------------------- | ----------------------------------------- |
| Hardware registers  | `register` keyword (ADR-004)              |
| Network protocols   | Explicit serialization functions          |
| Binary file formats | Explicit marshalling                      |
| Memory constraints  | Reorder struct fields largest-to-smallest |

## Research Findings

### Expert Consensus

> "I have very rarely seen 'packed' used in a way that is actually useful. Often when people think they need to pack a struct, they can get better results with more careful re-arrangement of the fields."
> — Eric S. Raymond, [The Lost Art of Structure Packing](http://www.catb.org/esr/structure-packing/)

### Safety Standards

- **MISRA C**: Using packed structs requires formal deviations from multiple rules (11.4, 17.4, 18.1/18.2)
- **CERT C**: DCL39-C warns about padding bytes leaking sensitive information; EXP03-C warns against assuming struct size

### Platform Issues

- **ARM Cortex-M0**: Does NOT support unaligned access — packed structs cause SIGBUS crashes
- **Atomicity**: Unaligned access breaks concurrent operations (lwarx/stwcx on PowerPC, cmpxchg16b)
- **Portability**: Compiler-specific behavior; layout differs between GCC, MSVC, and optimization levels
- **Performance**: Multi-byte loads for misaligned fields; code bloat from unaligned access handling

### Why Serialization is Better for Protocols

| Packed Structs (Bad)            | Serialization (Good)         |
| ------------------------------- | ---------------------------- |
| Architecture-dependent encoding | Platform-neutral encoding    |
| No endianness standardization   | Explicit byte order handling |
| No bounds checking              | Built-in validation          |
| Compiler-specific behavior      | Portable across toolchains   |

## Options Considered (Historical)

### Option A: Attributes

```cnx
@packed
struct TCPHeader {
    u16 srcPort;
    u16 dstPort;
    u32 seqNum;
}
```

### Option B: Keywords

```cnx
packed struct TCPHeader { ... }
```

### Option C: Pragma Pass-through

```cnx
#pragma pack(push, 1)
struct TCPHeader { ... }
#pragma pack(pop)
```

### Option D: Don't implement

**Selected.** The use cases are covered by existing features or better patterns.

## References

- [The Lost Art of Structure Packing](http://www.catb.org/esr/structure-packing/) — Eric S. Raymond
- [SEI CERT C DCL39-C](https://wiki.sei.cmu.edu/confluence/display/c/DCL39-C) — Avoid information leakage
- [MISRA C Forum Discussion](https://forum.misra.org.uk/) — Packed struct deviations
- [Feabhas: Peripheral Register Access](https://blog.feabhas.com/2019/01/peripheral-register-access-using-c-structs-part-1/) — Why struct overlays are problematic
- [Serialization for Embedded Systems](https://blog.mbedded.ninja/programming/serialization-formats/serialization-for-embedded-systems/) — Better alternatives
