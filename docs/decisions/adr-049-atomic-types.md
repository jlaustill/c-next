# ADR-049: Atomic Types

**Status:** Accepted
**Date:** 2026-01-03
**Accepted:** 2026-01-04
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

| Operation Type                 | Naturally Atomic?   | Notes                                    |
| ------------------------------ | ------------------- | ---------------------------------------- |
| Single-byte read/write         | Yes (all platforms) | `u8` is always atomic                    |
| 32-bit aligned read/write      | Yes (Cortex-M3+)    | Single LDR/STR instruction               |
| Read-Modify-Write (e.g., `++`) | No                  | Requires LDREX/STREX or critical section |
| 64-bit operations              | No                  | Always requires synchronization          |

### Platform Capabilities

| Feature                   | M0  | M0+ | M3/M4/M7 |
| ------------------------- | --- | --- | -------- |
| LDREX/STREX               | No  | Yes | Yes      |
| PRIMASK (disable all IRQ) | Yes | Yes | Yes      |
| BASEPRI (selective IRQ)   | No  | No  | Yes      |

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

| Operation | C++                   | Rust                  | Zig                 | Description             |
| --------- | --------------------- | --------------------- | ------------------- | ----------------------- |
| Load      | `.load()`             | `.load()`             | `@atomicLoad`       | Read value              |
| Store     | `.store()`            | `.store()`            | `@atomicStore`      | Write value             |
| Add       | `.fetch_add()`        | `.fetch_add()`        | `@atomicRmw(.Add)`  | Add and return old      |
| Sub       | `.fetch_sub()`        | `.fetch_sub()`        | `@atomicRmw(.Sub)`  | Subtract and return old |
| CAS       | `.compare_exchange()` | `.compare_exchange()` | `@cmpxchg`          | Compare and swap        |
| Exchange  | `.exchange()`         | `.swap()`             | `@atomicRmw(.Xchg)` | Swap and return old     |

### Memory Ordering

C++, Rust, and Zig all expose memory ordering semantics:

| Ordering | Description                                | Use Case                    |
| -------- | ------------------------------------------ | --------------------------- |
| Relaxed  | No ordering guarantees                     | Single-threaded or counters |
| Acquire  | Reads after this see writes before release | Lock acquisition            |
| Release  | Writes before this visible after acquire   | Lock release                |
| SeqCst   | Full sequential consistency                | When in doubt               |

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

| Type     | Atomic-Capable? | Notes                                       |
| -------- | --------------- | ------------------------------------------- |
| u8, i8   | ?               | Always naturally atomic                     |
| u16, i16 | ?               | Platform-dependent                          |
| u32, i32 | ?               | Naturally atomic on 32-bit, RMW needs LDREX |
| u64, i64 | ?               | Never naturally atomic on 32-bit            |
| f32, f64 | ?               | Floats typically not supported              |
| bool     | ?               | Could alias to u8                           |
| Structs  | ?               | Generally too complex                       |
| Pointers | ?               | Platform word size                          |

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

| Platform   | RMW Implementation         |
| ---------- | -------------------------- |
| Cortex-M3+ | LDREX/STREX loop           |
| Cortex-M0+ | LDREX/STREX loop           |
| Cortex-M0  | Critical section (PRIMASK) |

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

## Resolved Questions

### Q1: Declaration Syntax ✓

**Decision: Keyword modifier**

```cnx
atomic u32 counter <- 0;
atomic u8 flags <- 0;
atomic bool ready <- false;
```

**Rationale:**

- Senior C developers can understand it in 30 seconds
- Consistent with C-Next's `clamp`/`wrap` modifier pattern
- Makes `atomic` a first-class citizen in the language
- Clear and explicit without being verbose

### Q2 & Q3: Operation Syntax ✓

**Decision: Natural syntax with type-level behavior**

```cnx
// Declaration combines atomic + overflow behavior
atomic clamp u8 brightness <- 0;
atomic wrap u32 counter <- 0;
atomic bool ready <- false;

// Operations use standard C-Next syntax
brightness +<- 10;     // Atomic add with clamp
counter +<- 1;         // Atomic add with wrap
ready <- true;         // Atomic store
u32 val <- counter;    // Atomic load
```

**Key Insight: Behavior Belongs to the Type**

C-Next already has `clamp` and `wrap` modifiers that define overflow behavior at the type level. Atomic operations work the same way—the **type** carries the behavior, not the operation site.

When you write `brightness +<- 10` on an `atomic clamp u8`, the transpiler generates:

**For Cortex-M3+ (has LDREX/STREX):**

```c
// Atomic add-with-clamp, hidden retry loop
do {
    uint8_t old = __LDREXB(&brightness);
    uint8_t new_val = old + 10;
    if (new_val < old) new_val = 255;  // Overflow = clamp
} while (__STREXB(new_val, &brightness) != 0);
```

**For Cortex-M0 (no LDREX/STREX):**

```c
// Critical section fallback
uint32_t primask = __get_PRIMASK();
__disable_irq();
uint8_t old = brightness;
uint8_t new_val = old + 10;
if (new_val < old) new_val = 255;
brightness = new_val;
__set_PRIMASK(primask);
```

Multiple ISRs can call `brightness +<- 10`—the retry loop ensures each operation completes correctly even if interrupted.

**No Explicit CAS/fetchAdd Methods Needed**

Other languages (C++, Rust, Zig) expose operations like `fetchAdd()`, `compareExchange()`, etc. C-Next takes a different approach:

| Concern                   | Who Handles It               |
| ------------------------- | ---------------------------- |
| Atomicity                 | `atomic` keyword             |
| Overflow behavior         | `clamp`/`wrap` modifier      |
| Retry loops (LDREX/STREX) | Transpiler (hidden)          |
| Platform differences      | Transpiler (hidden)          |
| Conditional logic         | Developer via `critical { }` |

**Simple operations** (arithmetic, flags) → Type handles it automatically

**Complex conditional operations** (check-then-act) → Use critical blocks (ADR-050)

```cnx
// Simple: type handles atomicity and clamping
atomic clamp u8 brightness <- 250;
brightness +<- 10;  // Just works, safely

// Complex: conditional state transition needs critical block
atomic State machineState <- State.IDLE;
critical {
    if (machineState = State.IDLE) {
        machineState <- State.RUNNING;
    }
}
```

**Why Not Expose CAS?**

Compare-And-Swap (CAS) is the primitive that enables lock-free algorithms. It atomically checks "is the value what I expect?" and only writes if true.

For most embedded use cases, CAS isn't needed:

| Use Case                 | C-Next Solution                           | Needs CAS? |
| ------------------------ | ----------------------------------------- | ---------- |
| Atomic counter           | `atomic wrap u32` + `counter +<- 1`       | No         |
| Bounded value            | `atomic clamp u8` + `brightness +<- 5`    | No         |
| Flag                     | `atomic bool` + `flag <- true`            | No         |
| State machine transition | `critical { if (state = X) state <- Y; }` | No         |

The retry loop inside the transpiled code IS using CAS-like hardware (LDREX/STREX), but the developer never sees it. For conditional logic that doesn't fit simple arithmetic, `critical { }` blocks provide a clear, explicit solution.

### Q4: Which Types Can Be Atomic? ✓

**Decision: All scalar types allowed. Transpiler handles platform differences.**

| Type          | Allowed? | 32-bit MCU (Cortex-M)                   | 8-bit MCU (AVR)               |
| ------------- | -------- | --------------------------------------- | ----------------------------- |
| u8, i8, bool  | ✓        | Natural                                 | Natural                       |
| u16, i16      | ✓        | Natural                                 | Critical section              |
| u32, i32, f32 | ✓        | Natural load/store, LDREX/STREX for RMW | Critical section              |
| u64, i64, f64 | ✓        | Critical section (document cost)        | Critical section              |
| Enums         | ✓        | Inherits from underlying type           | Inherits from underlying type |
| bitmap8/16/32 | ✓        | Same as underlying integer              | Same as underlying integer    |
| Structs       | ✗        | Use `critical { }` block                | Use `critical { }` block      |
| Arrays        | ✗        | Use `critical { }` block                | Use `critical { }` block      |

**Guiding Principle**: C-Next makes the right thing easy, the wrong thing impossible, and remains flexible in between.

- 64-bit atomics on 32-bit platforms are **expensive but not wrong**
- Atomic floats are **uncommon but not wrong**
- The type declares **intent**, the transpiler makes it **safe for the target**

**Examples:**

```cnx
// All valid atomic declarations
atomic u8 flags <- 0;
atomic u32 counter <- 0;
atomic u64 timestamp <- 0;        // Expensive on 32-bit, but allowed
atomic f32 temperature <- 0.0;    // Uncommon, but valid
atomic bool ready <- false;

// Enums inherit atomic capability
enum State : u8 { IDLE, RUNNING, STOPPED }
atomic State machineState <- State.IDLE;  // Works like atomic u8

// Combined with overflow modifiers
atomic clamp u8 brightness <- 0;
atomic wrap u32 tickCount <- 0;

// NOT allowed - use critical blocks instead
// atomic MyStruct data;           // ERROR: structs not atomic
// atomic u8 buffer[16];           // ERROR: arrays not atomic
```

**Documentation Note**: 64-bit atomics on 32-bit platforms require disabling interrupts for every access. Use when correctness matters more than latency. Consider whether a `critical { }` block around multiple operations might be clearer.

### Q5: Memory Ordering ✓

**Decision: SeqCst always, no user-facing ordering options. Compiler enforces atomic access for ISR-shared variables.**

**Key Insight: Wrong Thing Impossible**

The memory ordering question becomes mostly irrelevant when C-Next enforces a stronger rule: **non-atomic variables accessed from both ISR and main code are a compile error.**

| Variable Access Pattern           | C-Next Response      |
| --------------------------------- | -------------------- |
| Only in main code                 | OK (no ISR concern)  |
| Only in ISR(s)                    | OK (no main concern) |
| Both ISR and main, **atomic**     | OK ✓                 |
| Both ISR and main, **non-atomic** | **COMPILE ERROR**    |
| Inside `critical { }` block       | OK (protected)       |

**Example of what C-Next prevents:**

```cnx
atomic bool dataReady <- false;
u32 sharedData <- 0;  // NOT atomic

interrupt Producer {
    sharedData <- 42;      // ERROR: non-atomic variable 'sharedData' accessed
                           //        from ISR but also accessed from main context
    dataReady <- true;
}

void main() {
    if (dataReady) {
        u32 val <- sharedData;  // Also accessed here - compiler detects the conflict
    }
}
```

**Correct version:**

```cnx
atomic bool dataReady <- false;
atomic u32 sharedData <- 0;  // Now atomic

interrupt Producer {
    sharedData <- 42;      // OK: atomic store with SeqCst ordering
    dataReady <- true;     // OK: atomic store with SeqCst ordering
}

void main() {
    if (dataReady) {
        u32 val <- sharedData;  // OK: atomic load with SeqCst ordering
    }
}
```

**Why SeqCst Always?**

1. **Correct by construction** — SeqCst (Sequential Consistency) is always safe
2. **Future-proof** — Works correctly when C-Next expands to multi-core
3. **No cognitive burden** — Developers don't need to understand Acquire/Release/Relaxed
4. **Minimal overhead** — On single-core Cortex-M, memory barriers are ~1-3 cycles

**What about Relaxed ordering for performance?**

Deferred to v2+. If profiling shows SeqCst is a bottleneck on multi-core targets, we could add:

```cnx
relaxed atomic u32 fastCounter <- 0;  // Expert opt-in, v2+
```

For v1, the simplicity of "all atomics are SeqCst" outweighs micro-optimization.

**The C-Next Philosophy Applied:**

- **Right thing easy**: Just mark shared variables as `atomic`
- **Wrong thing impossible**: Compiler prevents non-atomic ISR access
- **Flexible in between**: Use `critical { }` for complex multi-variable operations

### Q6: Target Platform Specification ✓

**Decision: Capability-based targeting with named aliases**

The transpiler needs three pieces of information to generate correct atomic code:

| Capability    | Values     | Purpose                                   |
| ------------- | ---------- | ----------------------------------------- |
| `word_size`   | 8, 16, 32  | Natural atomicity of types                |
| `ldrex_strex` | true/false | Lock-free RMW vs critical section         |
| `basepri`     | true/false | Selective interrupt masking (for ADR-050) |

**Named targets are just aliases** for these three capabilities:

```
# Target mapping (internal or config file)
# target_name,    word_size, ldrex_strex, basepri

cortex-m0,        32,        false,       false
cortex-m0+,       32,        true,        false
cortex-m3,        32,        true,        true
cortex-m4,        32,        true,        true
cortex-m7,        32,        true,        true
avr,              8,         false,       false
atmega328p,       8,         false,       false
teensy41,         32,        true,        true
arduino-uno,      8,         false,       false
stm32f4,          32,        true,        true
```

**Usage - known target:**

```cnx
#pragma target teensy41
// Maps to: word_size=32, ldrex_strex=true, basepri=true

atomic u32 counter <- 0;
counter +<- 1;  // Generates LDREX/STREX loop
```

**Usage - new/unsupported MCU:**

```cnx
// Specify capabilities directly
#pragma word_size 32
#pragma ldrex_strex true
#pragma basepri false

atomic u32 counter <- 0;
counter +<- 1;  // Generates LDREX/STREX loop
```

**Priority order for target resolution:**

```
1. Source pragmas (#pragma target OR individual capabilities)
       ↓ (if not present)
2. Command-line flag (--target=X or --word-size=32 --ldrex-strex=true --basepri=false)
       ↓ (if not present)
3. Build system detection (platformio.ini, Arduino IDE, CMake, etc.)
       ↓ (if not found)
4. COMPILER ERROR: Cannot determine target platform
```

**Contributing new targets:**

Adding support for a new MCU is simply adding one line to the target mapping:

```
my-exotic-mcu, 32, true, false
```

This makes C-Next easily extensible to new platforms without code changes.

**Validation:**

- If `#pragma target X` is used, X must be in the known target list
- If individual capabilities are used, ALL THREE must be specified
- Partial specification is a compiler error

```
error[E0802]: Incomplete target specification
  --> myfile.cnx:2
   |
 2 | #pragma word_size 32
   |
   | word_size specified but ldrex_strex and basepri are missing.
   | Either use '#pragma target <name>' or specify all three capabilities.
```

### Q7: Atomics Within Scope ✓

**Decision: Works naturally with `this.` prefix, no special handling needed**

Given the decisions from Q1-Q3 (keyword modifier, natural syntax), atomics in scopes "just work":

```cnx
scope Counter {
    atomic wrap u32 value <- 0;

    void increment() {
        this.value +<- 1;  // Atomic increment with wrap
    }

    u32 get() {
        return this.value;  // Atomic load
    }

    void reset() {
        this.value <- 0;    // Atomic store
    }
}

// Usage
Counter.increment();
u32 count <- Counter.get();
```

**Scopes can mix atomic and non-atomic members:**

```cnx
scope Sensor {
    atomic bool dataReady <- false;    // Shared with ISR
    atomic f32 lastReading <- 0.0;     // Shared with ISR
    u32 readCount <- 0;                // Main-only, not atomic

    void onNewReading(f32 value) {     // Called from ISR
        this.lastReading <- value;
        this.dataReady <- true;
    }

    void process() {                   // Called from main
        if (this.dataReady) {
            f32 val <- this.lastReading;
            this.dataReady <- false;
            this.readCount +<- 1;      // Not atomic - only accessed from main
        }
    }
}
```

**Complex operations still use `critical { }`:**

```cnx
enum State : u8 { IDLE, RUNNING, STOPPED }

scope Motor {
    atomic State current <- State.IDLE;

    void start() {
        critical {
            if (this.current = State.IDLE) {
                this.current <- State.RUNNING;
            }
        }
    }

    void stop() {
        this.current <- State.STOPPED;  // Simple atomic store
    }
}
```

The compiler tracks ISR vs main access per-member, not per-scope, so mixed atomicity within a scope is fully supported.

---

## All Questions Resolved ✓

1. ~~What syntax for declaring atomic variables?~~ **RESOLVED: keyword modifier**
2. ~~What syntax for atomic operations?~~ **RESOLVED: natural syntax**
3. ~~Should direct assignment be allowed?~~ **RESOLVED: yes, type handles safety**
4. ~~Which primitive types can be atomic?~~ **RESOLVED: all scalars, structs/arrays use critical**
5. ~~Should memory ordering be exposed or hidden?~~ **RESOLVED: SeqCst always, compiler enforces atomic for ISR-shared**
6. ~~How is target platform specified?~~ **RESOLVED: capability-based with named aliases**
7. ~~How do atomics work within `scope`?~~ **RESOLVED: works naturally with `this.` prefix**

---

## References

- [ADR-009: ISR Safety](adr-009-isr-safety.md) - Parent ADR
- [ARM LDREX/STREX](https://developer.arm.com/documentation/dht0008/a/ch01s02s01)
- [C++ std::atomic](https://en.cppreference.com/w/cpp/atomic/atomic)
- [Rust AtomicU32](https://doc.rust-lang.org/std/sync/atomic/struct.AtomicU32.html)
- [Zig Atomics](https://ziglang.org/documentation/master/#Atomics)
