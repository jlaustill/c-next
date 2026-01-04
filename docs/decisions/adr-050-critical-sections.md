# ADR-050: Critical Sections

**Status:** Research
**Date:** 2026-01-03
**Decision Makers:** C-Next Language Design Team
**Parent ADR:** [ADR-009: ISR Safety](adr-009-isr-safety.md)

## Context

Atomic types (ADR-049) handle single-variable operations, but some operations require multiple variables to be updated atomically. For example:

```c
// These two updates must happen together
buffer[write_index] = data;
write_index = write_index + 1;
```

If an ISR fires between these lines, it could see inconsistent state. Critical sections disable interrupts to guarantee atomicity of multi-statement operations.

### Related ADRs

- **ADR-009**: Parent ADR covering overall ISR safety strategy
- **ADR-049**: Atomic types (for single-variable operations)
- **ADR-051**: ISR-safe queues (built on critical sections internally)

---

## Research Findings

### ARM Cortex-M Mechanisms

| Mechanism | Availability | Effect | Use Case |
|-----------|--------------|--------|----------|
| **PRIMASK** | All Cortex-M | Disable ALL interrupts | Short critical sections |
| **BASEPRI** | M3/M4/M7 only | Disable interrupts ≤ priority N | Selective masking |

### PRIMASK Implementation

```c
// Disable all configurable interrupts
uint32_t primask = __get_PRIMASK();
__disable_irq();  // CPSID i

// Critical section code here

__set_PRIMASK(primask);  // Restore previous state
```

**Characteristics:**
- Simple, works on all Cortex-M
- Nestable via save/restore pattern
- Blocks ALL interrupts including high-priority

### BASEPRI Implementation

```c
// Only disable interrupts with priority >= threshold
uint32_t basepri = __get_BASEPRI();
__set_BASEPRI(priority << (8 - __NVIC_PRIO_BITS));

// Critical section code here

__set_BASEPRI(basepri);  // Restore
```

**Characteristics:**
- Only available on M3/M4/M7
- Higher-priority interrupts still fire
- Requires knowing interrupt priority levels

### RTIC's Stack Resource Policy

RTIC (Rust) automatically computes the "ceiling priority" for each resource:
1. Analyzes which tasks/ISRs access each shared variable
2. Computes ceiling = max priority of all accessors
3. When claiming resource, sets BASEPRI to ceiling
4. No explicit critical sections in user code

This is elegant but requires static analysis of all resource accesses.

### How Other Languages Handle Critical Sections

**Rust (bare-metal):**
```rust
cortex_m::interrupt::free(|_cs| {
    // Interrupts disabled in this closure
    SHARED.borrow(cs).replace(new_value);
});
```

**C (CMSIS):**
```c
__disable_irq();
// critical section
__enable_irq();
```

**Ada (Ravenscar):**
```ada
protected Counter is
   procedure Increment;  -- Automatically protected
end Counter;
```
Ada's protected objects handle this automatically.

---

## Design Questions

### Q1: Syntax for Critical Sections

**Option A: Block statement**
```cnx
critical {
    // Interrupts disabled here
}
```

**Option B: Explicit enter/exit**
```cnx
critical_enter();
// Code here
critical_exit();
```

**Option C: Closure-based (like Rust)**
```cnx
critical(|cs| {
    // Interrupts disabled
});
```

**Option D: Automatic (like Ada)**
Variables marked as `protected` automatically get critical sections on access.

### Q2: PRIMASK vs BASEPRI

**Option A: Always use PRIMASK**
- Simple, universal
- May block high-priority interrupts unnecessarily

**Option B: Support explicit priority parameter**
```cnx
critical(priority: 3) {
    // Only disable interrupts with priority >= 3
}
```
- More control, but user must know priority levels
- Not portable to M0

**Option C: Automatic priority inference (like RTIC)**
- Compiler tracks which ISRs use which variables
- Automatically computes ceiling priority
- Complex implementation

### Q3: Where Can Critical Sections Be Used?

| Context | Should it be allowed? | What mechanism? |
|---------|----------------------|-----------------|
| Main code | ? | PRIMASK or BASEPRI |
| Inside ISR | ? | Already in interrupt context |
| Inside `scope` functions | ? | Same as caller's context |

**Sub-question:** If `critical` is used inside an ISR, what should happen?
- On M3+: Could use BASEPRI to still allow higher-priority ISRs
- On M0: PRIMASK would disable all other ISRs
- Or: Should it be an error/warning?

### Q4: Nesting Behavior

```cnx
void outer() {
    critical {
        inner();  // inner() also has critical section
    }
}

void inner() {
    critical {
        // Already inside outer's critical section
    }
}
```

Should nested critical sections:
- Work correctly (save/restore handles this naturally)?
- Generate a warning?
- Be an error?

### Q5: Control Flow Inside Critical Sections

**Return from inside critical:**
```cnx
u32 getValue() {
    critical {
        return shared_value;  // What happens to interrupt state?
    }
}
```

**Break/continue inside critical:**
```cnx
while (condition) {
    critical {
        if (done) break;  // What happens?
    }
}
```

How should the compiler ensure interrupts are restored on all exit paths?

### Q6: Maximum Length / Complexity Warnings

Long critical sections increase interrupt latency. Should the compiler:
- Warn if critical section exceeds N statements?
- Warn if critical section contains function calls?
- Warn if critical section contains loops?
- Not enforce anything (trust developer)?

### Q7: Can Critical Be an Expression?

**Expression form:**
```cnx
u32 value <- critical { shared_data };
```

**Statement only:**
```cnx
u32 value;
critical {
    value <- shared_data;
}
```

### Q8: Platform Fallback

If BASEPRI-based critical sections are used but target is M0:
- Compile error?
- Fall back to PRIMASK with warning?
- Fall back silently?

---

## Open Questions Summary

1. What syntax for critical sections?
2. PRIMASK only, or also support BASEPRI/priority?
3. Where can critical sections be used (main, ISR, scope)?
4. How should nesting behave?
5. How to handle return/break/continue inside critical?
6. Should there be warnings for long/complex critical sections?
7. Should critical be an expression or statement only?
8. How to handle platform differences?

---

## References

- [ADR-009: ISR Safety](adr-009-isr-safety.md) - Parent ADR
- [ADR-049: Atomic Types](adr-049-atomic-types.md) - Related ADR
- [ARM Cortex-M Interrupt Priorities](https://www.state-machine.com/cutting-through-the-confusion-with-arm-cortex-m-interrupt-priorities)
- [RTIC Resource Locking](https://rtic.rs/)
- [CMSIS Core](https://arm-software.github.io/CMSIS_5/Core/html/group__intrinsic__CPU__gr.html)
