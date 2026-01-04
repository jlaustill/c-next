# ADR-049: Atomic Types

**Status:** Research
**Date:** 2026-01-03
**Decision Makers:** C-Next Language Design Team
**Parent ADR:** [ADR-009: ISR Safety](adr-009-isr-safety.md)

## Context

When sharing data between ISRs and main code, normal variable access is unsafe due to:
- **Torn reads/writes**: Multi-byte values partially updated
- **Read-Modify-Write races**: ISR fires between read and write phases
- **Compiler reordering**: Optimizer caches values or reorders accesses

C-Next needs a way to declare variables that are safe for ISR/main sharing, with the compiler generating appropriate code for the target platform.

### Related ADRs

- **ADR-009**: Parent ADR covering overall ISR safety strategy
- **ADR-050**: Critical sections (for complex multi-variable operations)
- **ADR-051**: ISR-safe queues (for producer-consumer patterns)

---

## Research Findings

### What Makes an Operation Atomic?

| Operation Type | Naturally Atomic? | Notes |
|----------------|-------------------|-------|
| Single-byte read/write | Yes (all platforms) | `u8` is always atomic |
| 32-bit aligned read/write | Yes (Cortex-M3+) | Single LDR/STR instruction |
| Read-Modify-Write (e.g., `++`) | No | Requires LDREX/STREX or critical section |
| 64-bit operations | No | Always requires synchronization |

### Platform Capabilities

| Feature | M0 | M0+ | M3/M4/M7 |
|---------|----|----|----------|
| LDREX/STREX | No | Yes | Yes |
| PRIMASK (disable all IRQ) | Yes | Yes | Yes |
| BASEPRI (selective IRQ) | No | No | Yes |

### How Other Languages Handle Atomics

**C++ `std::atomic<T>`:**
```cpp
std::atomic<uint32_t> counter{0};
counter.fetch_add(1, std::memory_order_relaxed);
uint32_t value = counter.load();
```

**Zig atomics:**
```zig
var counter: u32 = 0;
_ = @atomicRmw(u32, &counter, .Add, 1, .SeqCst);
const value = @atomicLoad(u32, &counter, .SeqCst);
```

**Rust `AtomicU32`:**
```rust
static COUNTER: AtomicU32 = AtomicU32::new(0);
COUNTER.fetch_add(1, Ordering::Relaxed);
let value = COUNTER.load(Ordering::Relaxed);
```

### Common Atomic Operations

All three languages provide similar operations:

| Operation | C++ | Rust | Zig | Description |
|-----------|-----|------|-----|-------------|
| Load | `.load()` | `.load()` | `@atomicLoad` | Read value |
| Store | `.store()` | `.store()` | `@atomicStore` | Write value |
| Add | `.fetch_add()` | `.fetch_add()` | `@atomicRmw(.Add)` | Add and return old |
| Sub | `.fetch_sub()` | `.fetch_sub()` | `@atomicRmw(.Sub)` | Subtract and return old |
| CAS | `.compare_exchange()` | `.compare_exchange()` | `@cmpxchg` | Compare and swap |
| Exchange | `.exchange()` | `.swap()` | `@atomicRmw(.Xchg)` | Swap and return old |

### Memory Ordering

C++, Rust, and Zig all expose memory ordering semantics:

| Ordering | Description | Use Case |
|----------|-------------|----------|
| Relaxed | No ordering guarantees | Single-threaded or counters |
| Acquire | Reads after this see writes before release | Lock acquisition |
| Release | Writes before this visible after acquire | Lock release |
| SeqCst | Full sequential consistency | When in doubt |

**Question:** Does C-Next need to expose memory ordering, or is single-core embedded simple enough to always use one ordering?

---

## Design Questions

### Q1: Syntax for Declaring Atomic Variables

**Option A: Keyword modifier**
```cnx
atomic u32 counter <- 0;
```

**Option B: Generic type**
```cnx
Atomic<u32> counter <- 0;
```

**Option C: Type suffix**
```cnx
u32_atomic counter <- 0;
```

### Q2: Syntax for Atomic Operations

**Option A: Method syntax**
```cnx
u32 value <- counter.load();
counter.store(42);
counter.increment();
```

**Option B: Function syntax**
```cnx
u32 value <- atomic_load(counter);
atomic_store(counter, 42);
atomic_increment(counter);
```

**Option C: Operator overloading with explicit RMW**
```cnx
u32 value <- counter;           // Atomic load
counter <- 42;                   // Atomic store
counter +<- 1;                   // Atomic increment (new operator)
```

### Q3: Should Direct Assignment Be Allowed?

**Option A: Error on direct access (force explicit operations)**
```cnx
atomic u32 x <- 0;
x <- 5;           // ERROR: Use x.store(5)
x <- x + 1;       // ERROR: Use x.increment()
```

**Option B: Allow direct access (implicit atomic)**
```cnx
atomic u32 x <- 0;
x <- 5;           // OK: Generates atomic store
x <- x + 1;       // OK: Generates atomic RMW
```

### Q4: Which Types Can Be Atomic?

| Type | Atomic-Capable? | Notes |
|------|-----------------|-------|
| u8, i8 | ? | Always naturally atomic |
| u16, i16 | ? | Platform-dependent |
| u32, i32 | ? | Naturally atomic on 32-bit, RMW needs LDREX |
| u64, i64 | ? | Never naturally atomic on 32-bit |
| f32, f64 | ? | Floats typically not supported |
| bool | ? | Could alias to u8 |
| Structs | ? | Generally too complex |
| Pointers | ? | Platform word size |

### Q5: Memory Ordering Exposure

**Option A: Always sequentially consistent**
- Simplest, safest, slight performance cost
- Most embedded is single-core where this doesn't matter

**Option B: Always relaxed**
- Best performance
- Safe for single-core, dangerous if ever multi-core

**Option C: Expose ordering as parameter**
```cnx
counter.load(Ordering.Relaxed);
counter.store(42, Ordering.Release);
```

**Option D: Context-dependent default**
- ISR access uses one ordering
- Main access uses another

### Q6: Code Generation for Different Platforms

How does the compiler know which intrinsics to emit?

| Platform | RMW Implementation |
|----------|-------------------|
| Cortex-M3+ | LDREX/STREX loop |
| Cortex-M0+ | LDREX/STREX loop |
| Cortex-M0 | Critical section (PRIMASK) |

**Related question:** How does C-Next know the target platform? (See ADR-009 Q6)

### Q7: Atomic Variables in Scopes

```cnx
scope Counter {
    atomic u32 value <- 0;

    void increment() {
        this.value.???();  // How does this work?
    }
}
```

How do atomic operations interact with the `scope` system?

---

## Open Questions Summary

1. What syntax for declaring atomic variables?
2. What syntax for atomic operations?
3. Should direct assignment be allowed or forced to use explicit methods?
4. Which primitive types can be atomic?
5. Should memory ordering be exposed or hidden?
6. How is target platform specified for code generation?
7. How do atomics work within `scope`?

---

## References

- [ADR-009: ISR Safety](adr-009-isr-safety.md) - Parent ADR
- [ARM LDREX/STREX](https://developer.arm.com/documentation/dht0008/a/ch01s02s01)
- [C++ std::atomic](https://en.cppreference.com/w/cpp/atomic/atomic)
- [Rust AtomicU32](https://doc.rust-lang.org/std/sync/atomic/struct.AtomicU32.html)
- [Zig Atomics](https://ziglang.org/documentation/master/#Atomics)
