# ADR-009: Safe Interrupt Service Routines (ISRs)

**Status:** Research
**Date:** 2025-12-26
**Decision Makers:** C-Next Language Design Team

## Context

Rust's embedded ecosystem requires `unsafe` blocks for ISR (Interrupt Service Routine) code. This is because ISRs introduce fundamental challenges that Rust's ownership model cannot statically verify:

1. **Shared mutable state** — ISR and main code access the same variables
2. **Reentrancy** — ISR can fire while main code is mid-operation
3. **Data races** — No mutex/lock available (would cause deadlock)
4. **Volatile semantics** — Compiler must not optimize away accesses
5. **Timing constraints** — ISRs must be fast, can't wait on locks

### The Rust Problem

```rust
// Rust requires unsafe for any ISR shared state
static mut COUNTER: u32 = 0;

#[interrupt]
fn TIM2() {
    unsafe {
        COUNTER += 1;  // Unsafe: shared mutable static
    }
}

fn main() {
    loop {
        let count = unsafe { COUNTER };  // Unsafe again
    }
}
```

Even with `critical-section` crates, the fundamental issue remains: the compiler cannot prove safety at compile time, so `unsafe` is required.

### The C-Next Opportunity

C-Next transpiles to C, which doesn't have Rust's ownership model. But we can still provide **compile-time guarantees** that make ISR code safe by construction, without needing an escape hatch.

---

## Research Questions

### Q1: What makes ISR code unsafe?

Core issues to address:
- [ ] Torn reads/writes (multi-byte values partially updated)
- [ ] Read-modify-write races (ISR fires between read and write)
- [ ] Compiler reordering/optimization of volatile accesses
- [ ] Shared state visibility (main doesn't see ISR's writes)
- [ ] Priority inversion (nested interrupts)

### Q2: What patterns do embedded developers actually use?

Common safe patterns in C:
- Volatile flags (single-byte, naturally atomic)
- Disable interrupts around critical sections
- Lock-free queues/ring buffers
- Double buffering
- Atomic read-clear registers

### Q3: How do other languages handle this?

Research needed:
- [ ] Rust: `critical-section`, `bare-metal`, RTIC framework
- [ ] Ada: Protected objects, Ravenscar profile
- [ ] Zig: How does it handle volatile/ISR?
- [ ] C++: `std::atomic`, `volatile` semantics
- [ ] Forth: Traditional embedded approach

### Q4: What can be verified at compile time?

Potential static checks:
- Variable is only accessed in ISR context
- Variable is only accessed with interrupts disabled
- Type is naturally atomic on target architecture
- Access pattern is provably safe (e.g., single-writer)

---

## Potential Approaches

### Option 1: Explicit ISR-Shared Annotation

```cnx
// Compiler tracks ISR-shared variables
isr_shared u8 flag <- 0;  // Must be atomic-width type

interrupt TIM2 {
    flag <- 1;  // OK: single-byte atomic write
}

void main() {
    if (flag = 1) {
        flag <- 0;  // OK: single-byte atomic write
    }
}
```

**Pros:** Explicit, easy to understand
**Cons:** Doesn't prevent all races (RMW still unsafe)

### Option 2: Critical Section Syntax

```cnx
shared u32 counter <- 0;

interrupt TIM2 {
    counter <- counter + 1;  // OK: ISR can't be interrupted by itself
}

void main() {
    critical {
        // Interrupts disabled in this block
        u32 local <- counter;
        counter <- local + 1;
    }
}
```

**Pros:** Explicit safety boundary, familiar pattern
**Cons:** Runtime cost (interrupt disable/enable), nested critical sections

### Option 3: ISR-Safe Types

```cnx
Atomic<u32> counter;  // Only atomic operations allowed
Flag event_pending;   // Set/clear/test only

interrupt TIM2 {
    counter.increment();    // Atomic increment
    event_pending.set();    // Atomic flag set
}

void main() {
    if (event_pending.test_and_clear()) {
        u32 count <- counter.load();
    }
}
```

**Pros:** Type system enforces safety
**Cons:** Limited operations, may need platform-specific atomics

### Option 4: Message Passing / Channels

```cnx
Channel<Event, 16> events;  // ISR produces, main consumes

interrupt TIM2 {
    events.send(Event.TimerTick);  // Lock-free enqueue
}

void main() {
    while (Event e <- events.receive()) {
        handle(e);
    }
}
```

**Pros:** No shared mutable state, clean separation
**Cons:** Memory overhead, may not fit all use cases

### Option 5: Ownership Annotations

```cnx
// Variable owned by ISR - main cannot access directly
isr_owned u32 isr_counter <- 0;

// Variable owned by main - ISR cannot access directly
main_owned u32 main_counter <- 0;

// Transfer ownership via atomic handoff
Mailbox<SensorReading> latest_reading;
```

**Pros:** Compile-time enforcement of ownership
**Cons:** Complex mental model, may be overly restrictive

### Option 6: Platform-Aware Atomics

```cnx
// Compiler knows target architecture's atomic guarantees
// On ARM Cortex-M: 32-bit aligned accesses are atomic
u32 counter <- 0;  // Compiler warns if used unsafely

interrupt TIM2 {
    // Single write is atomic on this platform
    counter <- counter + 1;  // WARNING: RMW not atomic!

    // Safe alternative:
    counter <- read_and_increment(&counter);  // Uses LDREX/STREX
}
```

**Pros:** Leverages hardware capabilities
**Cons:** Platform-specific, complex to implement

---

## C-Next Advantages

Things C-Next already does well for ISR safety:

1. **Register bindings with access modifiers**
   - Write-only registers (wo) generate simple writes, not RMW
   - Atomic set/clear/toggle registers avoid races

2. **Static allocation only (ADR-003)**
   - No heap allocation in ISRs
   - All memory is statically known

3. **No hidden control flow**
   - No exceptions, no hidden allocations
   - What you write is what executes

4. **Type-aware bit indexing (ADR-007)**
   - Single-bit operations on atomic registers are safe
   - `GPIO7.DR_SET[bit] <- true` is inherently atomic

---

## Open Questions

1. **Should C-Next have an `unsafe` escape hatch?**
   - Or should we aim for "safe by construction" only?

2. **How do we handle platform differences?**
   - 8-bit MCUs have different atomicity than 32-bit ARM

3. **What's the right level of abstraction?**
   - Too low: just volatile, user handles everything
   - Too high: complex type system, hard to learn

4. **How do we integrate with existing C ISR patterns?**
   - Need to work with vendor HALs and RTOSes

5. **What about nested interrupts / priority levels?**
   - Some platforms allow ISR to interrupt ISR

---

## Next Steps

1. **Research existing solutions** — Study Rust RTIC, Ada Ravenscar, MISRA C guidelines
2. **Survey embedded developers** — What patterns do they actually use?
3. **Prototype options** — Try implementing 1-2 approaches
4. **Hardware testing** — Verify on Teensy with real ISRs
5. **Document trade-offs** — Each approach has costs and benefits

---

## References

### Rust Embedded
- [The Embedded Rust Book: Concurrency](https://docs.rust-embedded.org/book/concurrency/)
- [RTIC (Real-Time Interrupt-driven Concurrency)](https://rtic.rs/)
- [critical-section crate](https://docs.rs/critical-section/)

### Ada/SPARK
- [Ada Ravenscar Profile](https://www.adacore.com/about-spark)
- [Protected Objects](https://learn.adacore.com/courses/intro-to-ada/chapters/tasking.html)

### MISRA C
- [MISRA C:2012 Guidelines for Embedded](https://www.misra.org.uk/)

### ARM Cortex-M
- [ARM: Exclusive Access Instructions](https://developer.arm.com/documentation/dui0646/c/the-cortex-m7-processor/exclusive-access-instructions)
- [Atomic Operations on Cortex-M](https://interrupt.memfault.com/blog/cortex-m-atomics)

### YouTube Reference
- Video that sparked this discussion: [Why Rust Embedded ISRs are Unsafe] (link TBD)
