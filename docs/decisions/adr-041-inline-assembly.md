# ADR-041: Inline Assembly

## Status
**Rejected**

## Decision

**No inline assembly in C-Next for v1.** When assembly is needed, write it in C.

## Rationale

C-Next transpiles to C, so inline assembly can be handled at the C level:

1. **Write assembly in C files** — Create a `.c` file with inline asm, link with C-Next output
2. **Use existing C intrinsics** — CMSIS, compiler builtins already exist and work
3. **Keep C-Next simple** — Assembly is rare, platform-specific, and bypasses all safety guarantees

### Example Workflow

```c
// platform_asm.c (pure C file)
#include <stdint.h>

void __wfi(void) {
    __asm volatile("wfi");
}

void __disable_irq(void) {
    __asm volatile("cpsid i");
}

uint32_t read_cycle_count(void) {
    uint32_t cycles;
    __asm volatile("mrc p15, 0, %0, c9, c13, 0" : "=r"(cycles));
    return cycles;
}
```

```cnx
// main.cnx - declare external functions
extern void __wfi();
extern void __disable_irq();
extern u32 read_cycle_count();

void idle() {
    __disable_irq();
    __wfi();
}
```

This approach:
- Uses battle-tested GCC/Clang inline asm syntax
- Keeps platform-specific code isolated
- Requires no new C-Next grammar or codegen
- Works today with extern declarations

## Original Context

Inline assembly is sometimes unavoidable:
- CPU-specific instructions (WFI, DSB, ISB)
- Performance-critical inner loops
- Hardware access not expressible in C
- Startup code

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

## Why All Options Were Rejected

1. **Option A** (pass-through GCC syntax) — Adds complexity; just write asm in C files
2. **Option B** (block syntax) — New syntax for something C already handles well
3. **Option C** (intrinsics only) — Can't cover all cases; C intrinsics already exist
4. **Option D** (no inline asm, use .s files) — This is essentially what we chose, but with C files instead

The key insight: C-Next transpiles to C, so there's no need to reinvent inline assembly syntax. Developers who need assembly can write it in C and link it.

## References

- GCC inline assembly
- ARM Cortex-M intrinsics
- CMSIS intrinsics
