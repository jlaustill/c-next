# ADR-009: Safe Interrupt Service Routines (ISRs)

**Status:** Research
**Date:** 2025-12-26
**Updated:** 2026-01-04
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

### Motivation: CAN Bus and Real Embedded Work

ISR safety is critical for practical embedded development. CAN bus communication, UART handling, timer callbacks, and sensor interrupts all require safe data sharing between ISRs and main code. Without this feature, C-Next cannot be used for real-world embedded projects.

---

## Research Findings

### Q1: What Makes ISR Code Unsafe?

ISR safety problems fall into 5 categories:

| Hazard                            | Description                                                         | Example                                                            |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Torn reads/writes**             | Multi-byte value partially updated when ISR fires mid-access        | Main reads `u32` while ISR is between writing bytes 2 and 3        |
| **Read-Modify-Write (RMW) races** | ISR fires between read and write phases                             | `counter++` is actually: load → increment → store (3 instructions) |
| **Compiler reordering**           | Optimizer caches values or reorders memory accesses                 | Loop reads cached value forever, never sees ISR's update           |
| **Visibility**                    | Main code doesn't see ISR's writes due to caching                   | Missing `volatile` causes optimizer to eliminate "redundant" reads |
| **Priority inversion**            | Higher-priority ISR blocked by lower-priority code holding resource | Nested interrupts with shared state                                |

**Key Insight:** `volatile` solves visibility but NOT atomicity. Many C programmers incorrectly believe `volatile` provides thread-safety — it only prevents compiler optimization, not hardware-level races.

### Q2: What Patterns Do Embedded Developers Actually Use?

Research into real-world embedded code (including [FlexCAN_T4](https://github.com/tonton81/FlexCAN_T4) for Teensy CAN bus) reveals common patterns:

#### Pattern 1: Single-Byte Flags (Naturally Atomic)

```c
volatile uint8_t data_ready = 0;  // Single-byte: atomic on all platforms

// ISR
void UART_IRQHandler(void) {
    rx_buffer[rx_head++] = UART->DR;
    data_ready = 1;  // Single-byte write is atomic
}

// Main
while (!data_ready);  // Single-byte read is atomic
process_data();
data_ready = 0;
```

#### Pattern 2: Critical Sections (Interrupt Disable)

```c
// Save interrupt state and disable
uint32_t primask = __get_PRIMASK();
__disable_irq();

// Critical section: safe to access shared data
shared_counter++;

// Restore previous interrupt state
__set_PRIMASK(primask);
```

#### Pattern 3: Producer-Consumer Queues (Lock-Free)

```c
// FlexCAN_T4 pattern: ISR enqueues, main dequeues
// Fixed-size ring buffer with separate read/write indices
// Single-producer (ISR), single-consumer (main) = no locks needed

// ISR only modifies write_index
// Main only modifies read_index
// Both can read both indices (for full/empty checks)
```

#### Pattern 4: Double Buffering

```c
// Two buffers: ISR writes to one while main reads from other
// Atomic pointer swap between them
volatile uint8_t* active_buffer;
uint8_t buffer_a[256], buffer_b[256];
```

#### Pattern 5: Hardware Atomic Registers

```c
// Many MCUs have atomic set/clear/toggle registers
GPIO->BSRR = (1 << pin);   // Atomic set (write-only register)
GPIO->BRR = (1 << pin);    // Atomic clear (write-only register)
```

### Q3: How Do Other Languages Handle This?

#### Rust RTIC (Real-Time Interrupt-driven Concurrency)

[RTIC](https://rtic.rs/) uses **Stack Resource Policy (SRP)** from academic real-time systems research:

- Maps tasks to hardware interrupt vectors with static priorities
- Uses **system ceiling** concept: when claiming a resource, raises priority to block potential conflicts
- On Cortex-M3+: Maps ceiling to **BASEPRI register** (selective interrupt masking)
- On Cortex-M0: Falls back to **PRIMASK** (disable all interrupts)
- Claims require only **2 instructions to enter, 1 to exit** (zero-cost)
- Compile-time analysis proves freedom from races — "correct by construction"

```rust
// RTIC example - compiler proves this is race-free
#[task(shared = [counter], priority = 1)]
fn task1(cx: task1::Context) {
    cx.shared.counter.lock(|counter| {
        *counter += 1;  // Safe: priority ceiling enforced
    });
}
```

#### Ada Ravenscar Profile

[Ravenscar](https://en.wikipedia.org/wiki/Ravenscar_profile) is a subset of Ada tasking for safety-critical systems:

- **Protected objects** encapsulate shared data with automatic locking
- Only **library-level** (static) tasks and protected objects allowed
- Deterministic, analyzable, memory-bounded
- Supports `Attach_Handler` for ISRs within protected objects
- Runtime is **less than 40KB** — small enough for embedded
- Used in DO-178B/C certified avionics systems

```ada
protected Counter is
   procedure Increment;  -- ISR can call this
   function Get return Integer;
private
   Value : Integer := 0;
end Counter;

protected body Counter is
   procedure Increment is
   begin
      Value := Value + 1;  -- Automatically protected
   end Increment;
end Counter;
```

#### Zig

Zig takes an explicit approach:

- **`volatile` is ONLY for MMIO** — not for ISR shared state
- Uses `@atomicLoad`/`@atomicStore` for ISR-safe access
- No higher-level abstractions — developer handles synchronization

```zig
var counter: u32 = 0;

// ISR
fn timer_isr() callconv(.C) void {
    _ = @atomicRmw(u32, &counter, .Add, 1, .SeqCst);
}

// Main
const value = @atomicLoad(u32, &counter, .SeqCst);
```

#### C++ (std::atomic)

C++11 added `std::atomic<T>` for lock-free atomic operations:

```cpp
std::atomic<uint32_t> counter{0};

// ISR
void TIM2_IRQHandler() {
    counter.fetch_add(1, std::memory_order_relaxed);
}

// Main
uint32_t value = counter.load(std::memory_order_relaxed);
```

#### MISRA C Guidelines

[MISRA C:2012](https://www.misra.org.uk/) provides ISR guidance:

- ISR functions should be named with `_isr` suffix for clarity
- ISRs should be `static` to prevent accidental calls from normal code
- Shared variables must be `volatile`
- ISRs should be minimal — defer work to main loop
- Install stub handlers for unused interrupt vectors

### Q4: ARM Cortex-M Hardware Capabilities

| Feature               | M0    | M0+    | M3/M4/M7       | Description                                 |
| --------------------- | ----- | ------ | -------------- | ------------------------------------------- |
| **PRIMASK**           | ✅    | ✅     | ✅             | Disable ALL configurable interrupts         |
| **BASEPRI**           | ❌    | ❌     | ✅             | Disable interrupts ≤ priority N (selective) |
| **LDREX/STREX**       | ❌    | ✅     | ✅             | Lock-free atomic read-modify-write          |
| **Natural atomicity** | 8-bit | 32-bit | 32-bit aligned | Single-instruction access guaranteed        |

#### LDREX/STREX (Exclusive Access)

ARM's [exclusive access instructions](https://developer.arm.com/documentation/dht0008/a/ch01s02s01) provide hardware-assisted lock-free atomics:

1. `LDREX` loads value and sets "exclusive monitor" flag
2. `STREX` stores value only if monitor is still set, returns success/fail
3. **Key behavior:** Monitor is automatically cleared when ANY exception occurs

This means if an ISR fires between LDREX and STREX, the STREX fails and the operation retries — the hardware automatically detects the race!

```c
// Atomic increment using LDREX/STREX
do {
    old_value = __LDREXW(&counter);
    new_value = old_value + 1;
} while (__STREXW(new_value, &counter) != 0);
```

#### Critical Section Implementation

```c
// PRIMASK approach (M0/M0+/M3+) - disables ALL interrupts
static inline uint32_t critical_enter(void) {
    uint32_t primask = __get_PRIMASK();
    __disable_irq();  // CPSID i
    return primask;
}

static inline void critical_exit(uint32_t primask) {
    __set_PRIMASK(primask);  // Restore previous state
}

// BASEPRI approach (M3+ only) - selective masking
// Allows higher-priority interrupts to still fire
static inline uint32_t critical_enter_basepri(uint8_t priority) {
    uint32_t basepri = __get_BASEPRI();
    __set_BASEPRI(priority << (8 - __NVIC_PRIO_BITS));
    return basepri;
}
```

### Real-World Example: FlexCAN_T4

The [FlexCAN_T4 library](https://github.com/tonton81/FlexCAN_T4) for Teensy CAN bus demonstrates production patterns:

**Architecture:**

```
ISR → [Ring Buffer (fixed size)] → main calls events() → user callback
```

**Key Design Decisions:**

- Pre-allocated circular buffers: `FlexCAN_T4<CAN3, RX_SIZE_256, TX_SIZE_16>`
- ISR only enqueues — never blocks, never calls user code directly
- Main loop calls `events()` to process queued messages
- Single-producer (ISR) / single-consumer (main) = no locks needed
- Provides weak functions for library interop

---

## Potential Approaches

Based on research, here are potential approaches for C-Next, organized by complexity level. These are a synthesis of patterns found across RTIC, Ravenscar, and real-world embedded code — not an industry standard.

### Approach 1: Atomic Types

Provide built-in atomic types that generate appropriate code for the target platform:

```cnx
// Atomic variable declaration
atomic u8 flag <- 0;           // Single-byte: naturally atomic everywhere
atomic u32 counter <- 0;       // 32-bit: LDREX/STREX on M3+, critical section on M0

// Atomic operations
u32 value <- counter.load();   // Volatile read
counter.store(42);             // Volatile write
counter.increment();           // Atomic RMW (LDREX/STREX or critical section)
counter.decrement();
bool was_set <- flag.test_and_set();   // Atomic flag operations
flag.clear();

// Compile-time enforcement
atomic u32 x <- 0;
x <- x + 1;     // ERROR: Use x.increment() for atomic RMW
x <- 5;         // ERROR: Use x.store(5) for atomic write
```

**Transpiles to (Cortex-M3+):**

```c
volatile uint32_t counter = 0;

// counter.increment()
do {
    uint32_t __old = __LDREXW(&counter);
    uint32_t __new = __old + 1;
} while (__STREXW(__new, &counter) != 0);

// counter.load()
uint32_t value = counter;  // volatile read
```

**Transpiles to (Cortex-M0):**

```c
volatile uint32_t counter = 0;

// counter.increment()
uint32_t __primask = __get_PRIMASK();
__disable_irq();
counter = counter + 1;
__set_PRIMASK(__primask);
```

### Approach 2: Critical Sections

Explicit scope for interrupt-disabled regions:

```cnx
u32 shared_data <- 0;

void updateData() {
    critical {
        // Interrupts disabled here
        u32 local <- shared_data;
        shared_data <- local + compute();
    }
    // Interrupts restored to previous state
}
```

**Transpiles to:**

```c
void updateData(void) {
    uint32_t __primask = __get_PRIMASK();
    __disable_irq();
    {
        uint32_t local = shared_data;
        shared_data = local + compute();
    }
    __set_PRIMASK(__primask);
}
```

**Considerations:**

- Should `critical` blocks be nestable? (Yes — save/restore pattern handles this)
- Should there be a maximum length lint? (Encourage short critical sections)
- Platform config for BASEPRI vs PRIMASK?

### Approach 3: ISR-Safe Queues

Built-in single-producer/single-consumer queue for ISR-to-main communication:

```cnx
// Fixed-size queue declaration
Queue<CAN_Message, 32> canRxQueue;

// In ISR: enqueue (lock-free, never blocks)
interrupt CAN_RX {
    CAN_Message msg <- readMailbox();
    canRxQueue.push(msg);  // Returns false if full
}

// In main: dequeue (lock-free)
void processMessages() {
    while (CAN_Message msg <- canRxQueue.pop()) {
        handleMessage(msg);
    }
}

// Queue properties
bool empty <- canRxQueue.empty();
bool full <- canRxQueue.full();
u32 count <- canRxQueue.count();
```

**Implementation Notes:**

- Single-producer/single-consumer: no locks needed
- Fixed size: no dynamic allocation
- Lock-free using atomic indices
- Push from ISR, pop from main (or vice versa)

### Approach 4: Protected Scopes (Ravenscar-inspired)

Encapsulate shared state with automatic protection:

```cnx
protected Counter {
    u32 value <- 0;

    // ISR can call this - automatically protected
    void increment() {
        value <- value + 1;
    }

    // Main can call this - automatically protected
    u32 get() {
        return value;
    }
}

interrupt TIM2 {
    Counter.increment();  // Protected access
}

void main() {
    u32 count <- Counter.get();  // Protected access
}
```

**Considerations:**

- More complex to implement
- May be overkill for simple cases
- Matches Ada/Ravenscar mental model
- Could defer to v2

---

## C-Next Advantages

Things C-Next already does well for ISR safety:

1. **Register bindings with access modifiers (ADR-004)**
   - Write-only registers (wo) generate simple writes, not RMW
   - Atomic set/clear/toggle registers avoid races
   - `GPIO7.DR_SET[bit] <- true` is inherently atomic

2. **Static allocation only (ADR-003)**
   - No heap allocation in ISRs
   - All memory is statically known
   - No malloc failure to handle

3. **No hidden control flow**
   - No exceptions, no hidden allocations
   - What you write is what executes
   - ISRs can be analyzed statically

4. **Type-aware bit indexing (ADR-007)**
   - Single-bit operations on atomic registers are safe
   - Compiler knows bit width, can validate

5. **ISR function type (ADR-040)**
   - `ISR` type for `void(void)` function pointers
   - Vector tables can be built in C-Next

---

## Open Questions

### Resolved Questions

1. **Should C-Next have an `unsafe` escape hatch?**

   **Resolution: No.** C-Next should aim for "safe by construction" without `unsafe`. The escape hatch is transpiling to readable C — developers can always modify the generated C if needed. This aligns with C-Next's philosophy of safety through removal, not addition.

2. **How do we handle platform differences?**

   **Resolution: Support all platforms, graceful degradation.** C-Next should support Cortex-M0 even if slower. If someone is using an M0, they already expect it to be slower. The compiler should:
   - Use LDREX/STREX on M3+ for atomic RMW
   - Fall back to critical sections on M0/M0+
   - Generate platform-appropriate code based on target config

### Open Questions

3. **How do we integrate with existing C ISR patterns?**

   **Status: Partially resolved, needs documentation and examples.**

   C-Next already provides the foundation:
   - Generates valid C with correct ISR signatures
   - Supports `--cpp` for C++ output
   - Has `ISR` type for function pointers (ADR-040)

   **Sub-questions and analysis:**

   #### 3a. Vector Table Placement

   How does a C-Next ISR end up in the hardware vector table?

   ```cnx
   // C-Next declares this...
   interrupt UART_RX {
       // handle interrupt
   }

   // But linker needs to know to put this at the correct vector address
   ```

   **Mechanisms (platform-dependent):**

   | Mechanism            | How It Works                                                         | Platforms              |
   | -------------------- | -------------------------------------------------------------------- | ---------------------- |
   | Naming convention    | Function named `UART_IRQHandler` matches weak symbol in startup file | CMSIS, STM32, most ARM |
   | Linker script        | Section attributes place function at specific address                | Bare metal             |
   | Runtime registration | `attachInterruptVector(IRQ_UART, handler)`                           | Teensyduino            |
   | Compiler attributes  | `__attribute__((interrupt("IRQ")))`                                  | GCC/Clang              |

   **Current C-Next approach:** Generate standard C function, user wires to vector table.

   **Possible enhancement:** `interrupt(vector: "UART_IRQHandler")` syntax to control generated name.

   #### 3b. C++ Callback Integration

   FlexCAN_T4 uses C++ member functions:

   ```cpp
   // FlexCAN_T4 API (C++)
   can.onReceive(myCallback);  // myCallback is a function pointer
   ```

   C-Next generates C, which can't call C++ member functions directly.

   **Solutions:**
   - Use `--cpp` flag to generate C++ output
   - Write `extern "C"` wrapper functions in a `.cpp` file
   - FlexCAN callbacks are actually C-compatible function pointers

   #### 3c. Vendor HAL Patterns

   | Vendor      | Pattern                            | C-Next Integration      |
   | ----------- | ---------------------------------- | ----------------------- |
   | CMSIS       | `void SysTick_Handler(void)`       | Match naming convention |
   | Arduino     | `attachInterrupt(pin, func, mode)` | Pass function pointer   |
   | STM32 HAL   | `HAL_UART_RxCpltCallback()`        | Override weak symbol    |
   | Teensyduino | `attachInterruptVector()`          | Runtime registration    |

   #### 3d. Remaining Work
   1. **Documentation**: "How to use C-Next ISRs with [Teensy/STM32/etc]"
   2. **Examples**: Real FlexCAN_T4 integration example
   3. **Possible v2 feature**: ISR naming convention support

4. **What about nested interrupts / priority levels?**

   **Resolution: Answered by ADR-050.** Critical sections use automatic ceiling priority computation (RTIC-inspired). The compiler analyzes which ISRs access which variables and sets BASEPRI to the computed ceiling. On M0/M0+ (no BASEPRI), falls back to PRIMASK. See [ADR-050: Critical Sections](adr-050-critical-sections.md) Q2 for full details.

5. **Scope of v1 implementation?**

   **Resolution: v1 ISR safety is complete.**
   - Atomic types (Approach 1) — **Implemented** (ADR-049)
   - Critical sections (Approach 2) — **Implemented** (ADR-050)
   - ISR-safe queues (Approach 3) — Deferred to v2 (ADR-104)
   - Protected scopes (Approach 4) — Deferred to v2

6. **Target configuration mechanism?**

   **Resolution: Answered by ADR-049.** Capability-based targeting with named aliases. Transpiler needs three capabilities: `word_size`, `ldrex_strex`, and `basepri`. Named targets (e.g., `teensy41`, `cortex-m0`) are aliases for these capabilities. Specified via `#pragma target`, command-line flag, or build system detection. See [ADR-049: Atomic Types](adr-049-atomic-types.md) Q6 for full details.

---

## Child ADRs

This ADR has been split into focused ADRs:

| ADR                                       | Topic                 | Status          | Summary                                                                             |
| ----------------------------------------- | --------------------- | --------------- | ----------------------------------------------------------------------------------- |
| [ADR-049](adr-049-atomic-types.md)        | Atomic Types          | **Implemented** | `atomic` keyword, natural syntax, SeqCst always, compiler-enforced ISR safety       |
| [ADR-050](adr-050-critical-sections.md)   | Critical Sections     | **Implemented** | `critical { }` blocks, automatic ceiling priority (RTIC-inspired), PRIMASK fallback |
| [ADR-104](adr-104-isr-queues.md)          | ISR-Safe Queues       | Research (v2)   | Producer-consumer patterns, 9 open design questions                                 |
| [ADR-106](adr-106-isr-vector-bindings.md) | Vector Table Bindings | Research        | Treat vector table as register binding, platform-specific ISR assignment            |

## Next Steps

1. ~~Resolve open questions in ADR-049~~ — **Done** (Implemented 2026-01-06)
2. ~~Resolve open questions in ADR-050~~ — **Done** (Implemented 2026-01-06)
3. ~~Resolve open questions in ADR-104~~ — **Deferred to v2**
4. **Research C interop philosophy** — C-Next makes C-Next code safe, not C code (Q3)
5. **Prototype on Teensy** — Test with real CAN bus ISRs

---

## References

### Rust Embedded

- [The Embedded Rust Book: Concurrency](https://docs.rust-embedded.org/book/concurrency/)
- [RTIC (Real-Time Interrupt-driven Concurrency)](https://rtic.rs/)
- [critical-section crate](https://docs.rs/critical-section/)

### Ada/SPARK

- [Ada Ravenscar Profile (Wikipedia)](https://en.wikipedia.org/wiki/Ravenscar_profile)
- [SPARK Concurrency Guide](https://docs.adacore.com/spark2014-docs/html/ug/en/source/concurrency.html)
- [Ravenscar Profile Guide (PDF)](https://www.math.unipd.it/~tullio/RTS/2019/YCS-2017.pdf)

### ARM Cortex-M

- [ARM: LDREX and STREX](https://developer.arm.com/documentation/dht0008/a/ch01s02s01)
- [How ARM Ensures Atomicity (Medium)](https://medium.com/embedworld/how-arm-ensures-atomicity-ldrex-strex-explained-abe66eaa0cdc)
- [ARM Cortex-M Interrupt Priorities](https://www.state-machine.com/cutting-through-the-confusion-with-arm-cortex-m-interrupt-priorities)
- [Memfault: ARM Cortex-M Exceptions and NVIC](https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic)

### MISRA C

- [MISRA C:2012 Guidelines](https://www.misra.org.uk/)
- [Barr Group: ISR Coding Standard](https://barrgroup.com/embedded-systems/books/embedded-c-coding-standard/procedure-rules/interrupt-functions)

### Real-World Libraries

- [FlexCAN_T4 (Teensy CAN Library)](https://github.com/tonton81/FlexCAN_T4)

### General

- [Zig Documentation: Volatile](https://ziglang.org/documentation/master/)
- [5 Best Practices for Writing ISRs (Embedded.com)](https://www.embedded.com/5-best-practices-for-writing-interrupt-service-routines/)
