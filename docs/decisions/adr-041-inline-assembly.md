# ADR-041: Inline Assembly

## Status
**Research**

## Context

Inline assembly is sometimes unavoidable:
- CPU-specific instructions (WFI, DSB, ISB)
- Performance-critical inner loops
- Hardware access not expressible in C
- Startup code

## Decision Drivers

1. **Hardware Access** - Sometimes only asm works
2. **Safety** - Asm bypasses all safety
3. **Portability** - Asm is architecture-specific
4. **Rarity** - Should be very uncommon

## Options Considered

### Option A: Pass-Through GCC Syntax
```cnx
asm volatile("wfi");
asm volatile("dsb" ::: "memory");
```

**Pros:** Direct C mapping
**Cons:** GCC-specific syntax

### Option B: Block Syntax
```cnx
asm {
    mov r0, #0
    wfi
}
```

**Pros:** Cleaner
**Cons:** New syntax

### Option C: Intrinsics Only
No inline asm. Provide intrinsic functions:
```cnx
__wfi();
__dsb();
__isb();
__disable_irq();
__enable_irq();
```

**Pros:** Type-safe, portable
**Cons:** Can't cover everything

### Option D: No Inline Assembly
Call out to .s files for any assembly.

**Pros:** Clear separation
**Cons:** More files, harder for simple cases

## Recommended Decision

**Option A: Pass-Through GCC Syntax** for v1 - Don't reinvent.

Pair with library of common intrinsics.

## Syntax

### Simple Assembly
```cnx
// Wait for interrupt
asm volatile("wfi");

// Data synchronization barrier
asm volatile("dsb");
asm volatile("isb");
```

### With Inputs/Outputs
```cnx
u32 readCycleCount() {
    u32 cycles;
    asm volatile("mrc p15, 0, %0, c9, c13, 0" : "=r"(cycles));
    return cycles;
}
```

### Memory Clobber
```cnx
void memoryBarrier() {
    asm volatile("" ::: "memory");
}
```

### Common Intrinsics (Library)
```cnx
// Provided by platform library
inline void __wfi() {
    asm volatile("wfi");
}

inline void __disable_irq() {
    asm volatile("cpsid i");
}

inline void __enable_irq() {
    asm volatile("cpsie i");
}
```

## Implementation Notes

### Grammar Changes
```antlr
asmStatement
    : 'asm' 'volatile'? '(' STRING_LITERAL asmOperands? ')' ';'
    ;

asmOperands
    : ':' asmOutputs? ':' asmInputs? ':' asmClobbers?
    ;
```

### CodeGenerator
Direct pass-through to C.

### Priority
**Low** - Rare use case, workarounds exist.

## Open Questions

1. Platform intrinsic library?
2. Validate asm syntax at all?
3. Warn about asm usage?

## References

- GCC inline assembly
- ARM Cortex-M intrinsics
- CMSIS intrinsics
