# ADR-100: Multi-Core Synchronization

**Status:** Research (v2)
**Date:** 2026-01-04
**Decision Makers:** C-Next Language Design Team
**Version:** v2

## Context

This ADR addresses multi-core MCU synchronization (ESP32, RP2040, etc.) which is deferred from v1. On multi-core systems, disabling interrupts on one core has no effect on the other core, requiring spinlock-based synchronization.

### Related ADRs

- **ADR-050**: Critical sections (v1, single-core focus)
- **ADR-101**: Heap allocation (v2)

---

## Background from ADR-050 Research

### The Problem

On single-core Cortex-M, disabling interrupts (PRIMASK/BASEPRI) provides mutual exclusion. On dual-core MCUs like ESP32 and RP2040, disabling interrupts on one core has **no effect** on the other core.

### ESP32 Pattern

ESP-IDF uses spinlock + interrupt disable:

```c
static portMUX_TYPE spinlock = portMUX_INITIALIZER_UNLOCKED;

taskENTER_CRITICAL(&spinlock);
// 1. Disable interrupts on THIS core
// 2. Spin until spinlock acquired (atomic compare-and-set)
// Access shared resource
taskEXIT_CRITICAL(&spinlock);
```

### RP2040 Pattern

RP2040 provides 32 hardware spinlocks:

```c
critical_section_t crit_sec;
critical_section_init(&crit_sec);

critical_section_enter_blocking(&crit_sec);
// Interrupts disabled + spinlock held
critical_section_exit(&crit_sec);
```

---

## Design Questions

### Q1: Syntax for Multi-Core Critical Sections

**Option A: Separate primitive**
```cnx
critical_sync(my_spinlock) { ... }
```

**Option B: Parameter on critical**
```cnx
critical(lock: my_spinlock) { ... }
```

**Option C: Automatic detection**
```cnx
critical { ... }  // Compiler adds spinlock for multi-core targets
```

### Q2: Spinlock Declaration Syntax

```cnx
// Option 1: Keyword
spinlock queue_lock;

// Option 2: Type
Spinlock queue_lock;

// Option 3: Scoped
scope Queue {
    spinlock lock;
}
```

### Q3: Memory Barriers

When are DMB/DSB/ISB instructions needed in transpiled output?

### Q4: Target Detection

How does the compiler know a target is multi-core?

---

## Open Questions Summary

1. What syntax for multi-core critical sections?
2. How should spinlocks be declared?
3. When are memory barriers needed?
4. How to detect multi-core targets?

---

## References

- [ESP-IDF FreeRTOS SMP](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/freertos-smp.html)
- [Pico SDK hardware_sync](https://cec-code-lab.aps.edu/robotics/resources/pico-c-api/group__hardware__sync.html)
- [ADR-050: Critical Sections](adr-050-critical-sections.md)
