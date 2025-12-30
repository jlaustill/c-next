# ADR-034: C-Style Bit Fields

## Status
**Research**

## Context

C bit fields pack multiple values into bytes/words:
```c
struct StatusReg {
    unsigned int ready : 1;
    unsigned int error : 1;
    unsigned int mode : 3;
    unsigned int reserved : 3;
};
```

C-Next already has register bitfields (ADR-004), but C-style bit fields in regular structs are sometimes needed.

## Decision Drivers

1. **Memory Efficiency** - Pack flags into single byte/word
2. **Hardware Compatibility** - Match device register layouts
3. **ADR-004 Overlap** - Register bitfields already exist
4. **Portability** - Bit field ordering is implementation-defined

## Options Considered

### Option A: C-Style Syntax
```cnx
struct Flags {
    bool ready : 1;
    bool error : 1;
    u8 mode : 3;
}
```

### Option B: Explicit Bit Range
```cnx
struct Flags {
    ready: bits[0..1];
    error: bits[1..2];
    mode: bits[2..5];
}
```

### Option C: Use ADR-007 Instead
Don't add C-style bit fields. Use type-aware bit indexing:
```cnx
u8 flags;
flags[0] <- true;      // ready
flags[1] <- false;     // error
flags[2, 3] <- mode;   // mode (3 bits)
```

## Recommended Decision

**Option C: Use ADR-007 Instead** for v1.

Rationale:
- C bit field ordering is non-portable
- ADR-007 bit indexing already works
- ADR-004 register bitfields handle hardware registers
- Simpler to avoid complexity

## Workaround with ADR-007

```cnx
// Instead of bit field struct:
struct StatusRegister {
    u8 raw;
}

// Access bits via indexing
status.raw[0] <- true;           // ready bit
status.raw[1] <- true;           // error bit
status.raw[2, 3] <- mode;        // mode field

// Read
bool ready <- status.raw[0];
u8 currentMode <- status.raw[2, 3];
```

Or define constants for clarity:
```cnx
const u32 READY_BIT <- 0;
const u32 ERROR_BIT <- 1;
const u32 MODE_START <- 2;
const u32 MODE_WIDTH <- 3;

status.raw[READY_BIT] <- true;
status.raw[MODE_START, MODE_WIDTH] <- mode;
```

## Future Consideration

If user demand is high, revisit with explicit bit positions:
```cnx
@packed
struct Flags {
    @bits(0, 1) bool ready;
    @bits(1, 1) bool error;
    @bits(2, 3) u8 mode;
}
```

### Priority
**Low** - ADR-007 covers most use cases.

## Open Questions

1. Revisit if users need actual C bit field layout matching?
2. Integration with ADR-004 register bitfields?

## References

- C bit fields
- ADR-004 Register Bindings
- ADR-007 Type-Aware Bit Indexing
