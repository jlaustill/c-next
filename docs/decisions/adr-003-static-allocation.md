# ADR-003: Static Memory Allocation

**Status:** Implemented
**Date:** 2025-12-26
**Decision Makers:** C-Next Language Design Team

## Context

Dynamic memory allocation introduces non-determinism and failure modes that are unacceptable in safety-critical embedded systems. Industry standards explicitly prohibit it, and C-Next v1 follows this restriction for its target use case.

> **Note:** C-Next v1 targets the most restrictive embedded use case (MISRA-compliant, safety-critical). Dynamic allocation for desktop and less-constrained targets is planned for v2 - see [ADR-101: Heap Allocation](adr-101-heap-allocation.md).

### The Problems with Dynamic Allocation

1. **Memory Leaks** — Allocated memory never freed
2. **Fragmentation** — Free memory exists but can't be used (non-contiguous)
3. **Use-After-Free** — Accessing memory after deallocation
4. **Double-Free** — Freeing memory twice
5. **Allocation Failure** — Running out of heap at runtime
6. **Non-Deterministic Timing** — Allocation time varies unpredictably

> "Fragmentation is similar to entropy: both increase over time. In a long running system (i.e., most every embedded system ever created), fragmentation may eventually cause some allocation requests to fail."
> — [Barr Group](https://barrgroup.com/embedded-systems/how-to/top-five-nasty-firmware-bugs)

---

## Research: Industry Standards

### MISRA C:2023 Directive 4.12

> "Dynamic memory allocation shall not be used."
> — [MathWorks: MISRA C:2023 Dir 4.12](https://www.mathworks.com/help/bugfinder/ref/misrac2023dir4.12.html)

The prohibition includes `malloc()`, `calloc()`, `realloc()`, `aligned_alloc()`, `free()`, and any user-defined equivalents.

> "The most common strategy in high criticality systems is that all memory required by a program is allocated during program initialization/startup and, once initialization is complete, memory allocation is forbidden."
> — [MISRA Forum](https://forum.misra.org.uk/archive/index.php?thread-928.html=)

### DO-178C / DO-332 (Aerospace)

DO-332 (Object-Oriented Technology supplement) specifically addresses dynamic memory allocation challenges:

> "DO-332 places particular emphasis on requirements related to dynamic memory allocation, a complex topic with challenges like ambiguity, fragmentation starvation, deallocation starvation, memory exhaustion, and premature deallocation."
> — [Wind River: DO-178C](https://www.windriver.com/solutions/learning/do-178c)

Requirements include:

- Verifying successful allocation for every request
- Accurate calculations of memory usage to prevent leakage
- Robust dynamic memory management verification at Levels A and B

### Broader Context: Memory Safety in Embedded Systems

While the primary rationale for static allocation is determinism and certification requirements, it also contributes to overall memory safety. Memory bugs remain the #1 exploited vulnerability class:

> "According to the 2024 CWE Top 10 KEV Weaknesses List Insights, memory safety remains the #1 type of exploited vulnerability in 2024."
> — [Barr Group: Top 10 Causes of Nasty Embedded Software Bugs](https://barrgroup.com/embedded-systems/how-to/top-ten-nasty-firmware-bugs)

**Note:** Memory safety is a broader category than dynamic allocation. The Toyota unintended acceleration case (2013), often cited in embedded safety discussions, involved stack overflow and memory corruption - not heap allocation specifically. Static allocation eliminates heap-related bugs but is just one part of a comprehensive memory safety strategy.

---

## Research: How Other Languages Handle This

### Rust Embedded (`heapless` crate)

Rust's embedded ecosystem uses the `heapless` crate for static data structures:

> "The core principle behind heapless is that its data structures are backed by a static memory allocation... All heapless data structures store their memory allocation inline and specify their capacity via their type parameter N."
> — [heapless crate documentation](https://docs.rs/heapless/latest/heapless/)

**Key Benefits:**

- O(1) operations (truly constant, not amortized)
- No OOM risk during operation
- Compile-time capacity specification
- No memory allocator required

**Available Structures:** Vec, String, BinaryHeap, Deque, IndexMap, IndexSet, queues

**Trade-off:** Operations like `push` return `Result` because they can fail if capacity is exceeded.

```rust
// Rust heapless example
let mut vec: Vec<u8, 8> = Vec::new();  // Capacity of 8, specified in type
vec.push(1)?;  // Returns Result, may fail
```

### Ada/SPARK

Ada provides user-defined storage pools for controlled allocation:

> "With [user-defined storage pools], a user can implement the behavior of memory management for a given pointer type (for example, maintaining a pool of fixed-size blocks to avoid fragmentation, with constant time for allocation and deallocation)."
> — [AdaCore: Safe Dynamic Memory Management](https://www.adacore.com/papers/safe-dynamic-memory-management-in-ada-and-spark)

SPARK (Ada's formally verified subset) recently added Rust-inspired borrow checking:

> "An extension to Ada and SPARK provides pointer types that offer provably safe, automatic storage management without any asynchronous garbage collection, and without explicit deallocation by the user."
> — [AdaCore](https://www.adacore.com/papers/safe-dynamic-memory-management-in-ada-and-spark)

**Ada/SPARK High Integrity Policies:**

- DYN01: Common High Integrity Restrictions
- DYN02: Traditional Static Allocation Policy
- DYN03: Access Types Without Allocators Policy
- DYN04: Minimal Dynamic Allocation Policy
- DYN05: User-Defined Storage Pools Policy
- DYN06: Statically Determine Maximum Stack Requirements

### Zig

Zig takes explicit allocator parameters to avoid hidden allocations:

> "There is no hidden control flow, no hidden memory allocations, no preprocessor, and no macros."
> — [Zig: Why Zig](https://ziglang.org/learn/why_zig_rust_d_cpp/)

> "Any functions that need to allocate memory accept an allocator parameter. As a result, the Zig Standard Library can be used even for the freestanding target."
> — [Zig Overview](https://ziglang.org/learn/overview/)

**Key Insight:** By making allocation explicit, code can be reused across environments (embedded, server, WASM) with appropriate allocators.

### TigerBeetle Database

TigerBeetle uses "no allocation after startup":

> "All allocation happens at startup, and there's no deallocation. The long-lived event loop goes round and round happily without alloc."
> — [matklad: Static Allocation For Compilers](https://matklad.github.io/2025/12/23/static-allocation-compilers.html)

This is the same pattern MISRA recommends: allocate at init, then forbid allocation.

---

## Research: Allocation Patterns

### Memory Pools

> "In some scenarios, you don't have the luxury of using malloc or other sophisticated memory allocators. In such cases, a pool allocator is a feasible solution. Each time you call allocate, it provides you with a fixed block of memory."
> — [Medium: Pool Memory Allocator in C](https://medium.com/@learn_aryan/pool-memory-allocator-in-c-embedded-systems-22e9f1d0026e)

**Properties:**

- Fixed-size blocks eliminate fragmentation
- O(1) allocation and deallocation
- Predictable memory usage
- Used by PostgreSQL ("pools"), Apache HTTP Server ("pools")

### Arena Allocators

> "In Big-O notation, arena allocation has complexity of O(1) (constant). Due to being the simplest allocator possible, the arena allocator does not allow the user to free certain blocks of memory. The memory is usually freed all at once."
> — [gingerbill: Memory Allocation Strategies](https://www.gingerbill.org/article/2019/02/08/memory-allocation-strategies-002/)

**History:**

> "In 1990, Hanson demonstrated that explicit regions in C (which he called arenas) could achieve time performance per allocated byte superior to even the fastest-known heap allocation mechanism."
> — [Wikipedia: Region-based memory management](https://en.wikipedia.org/wiki/Region-based_memory_management)

### Game Engine Frame Allocators

Game engines use frame-based allocators that reset each frame:

> "A common pattern in games is that memory needs to be allocated during a frame and then only gets used during that frame - this fact can be exploited for performance."
> — [Isetta Engine: Memory](https://isetta.io/compendium/Memory/)

> "Most game engines use the strategy of 'allocate a big block of memory during startup & use it as it is.'"
> — [Jennifer Chukwu: Memory Management in Game Engines](https://jenniferchukwu.com/posts/memory)

---

## Research: Practical Patterns in MISRA-Compliant Systems

How do real safety-critical systems handle variable-length data like UART messages and strings without dynamic allocation?

### UART: Fixed-Size Circular Buffers

The standard pattern is a **statically-allocated circular (ring) buffer** with a compile-time maximum size:

```c
// Static allocation - size known at compile time
#define UART_RX_BUFFER_SIZE 256
static uint8_t rxBuffer[UART_RX_BUFFER_SIZE];
static volatile uint16_t head = 0;
static volatile uint16_t tail = 0;
```

For protocols without fixed message lengths (terminal commands, sensor streams), MISRA-compliant systems use:

1. **IDLE Line Detection** — Hardware detects when RX line goes quiet for 1+ character time
2. **DMA + Circular Buffer** — DMA writes continuously to a fixed buffer in circular mode
3. **Half-Transfer Interrupts** — Process data when buffer is half-full to avoid overflow

> "Put DMA to circular mode to avoid race conditions... Set memory length big enough to be able to receive all bytes while processing another."
> — [MaJerle: STM32 USART DMA RX/TX](https://github.com/MaJerle/stm32-usart-uart-dma-rx-tx)

> "IDLE line detection can trigger USART interrupt when receive line is steady without any communication for at least 1 character for reception."
> — [DeepBlue Embedded: STM32 UART IDLE Line Detection](https://deepbluembedded.com/stm32-uart-receive-unknown-length-idle-line-detection-examples/)

**Key insight:** You don't allocate per-message. You have ONE buffer big enough for worst-case, and you process data in-place or copy to a processing buffer of known size.

### AUTOSAR CAN Buffers

AUTOSAR (automotive standard) uses the same static allocation approach:

> "The maximum number of simultaneous connections is statically configured. This configuration has an important impact on complexity and resource consumption... resources (e.g. Rx and Tx state machines, variables) have to be reserved for each connection."
> — [AUTOSAR CAN Transport Layer Specification](https://www.autosar.org/fileadmin/standards/R21-11/CP/AUTOSAR_SWS_CANTransportLayer.pdf)

All buffers are statically configured at compile time based on worst-case message sizes and maximum simultaneous connections.

### Strings: Bounded/Fixed-Length Approaches

#### Pattern 1: Fixed-Size Character Arrays

```c
// Always allocate max possible size
#define MAX_ERROR_MSG_LEN 64
static char errorMessage[MAX_ERROR_MSG_LEN];

// Use snprintf (NOT sprintf) to prevent overflow
snprintf(errorMessage, MAX_ERROR_MSG_LEN, "Error %d at line %d", code, line);
```

Standard `sprintf` is effectively banned in safety-critical code:

> "Due to general security reasons it is highly recommended to prefer and use snprintf (with the max buffer size as count parameter) instead of sprintf."
> — [Embedded Artistry: Embedded-friendly printf](https://embeddedartistry.com/blog/2019/11/06/an-embedded-friendly-printf-implementation/)

#### Pattern 2: Bounded String Types (Ada Approach)

Ada's aerospace/defense ecosystem uses **Bounded_String** — a type that always allocates its maximum capacity:

> "A Bounded-Length String type always allocates memory for the maximum permitted string length for the type."
> — [AdaCore: Standard Library Strings](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_strings.html)

```ada
-- Ada bounded string: max 80 characters, always uses 80 bytes
declare
   Name : Bounded_String(Max_Length => 80);
begin
   Name := To_Bounded_String("Hello");  -- Uses 80 bytes, stores 5 chars + length
end;
```

#### Pattern 3: Embedded-Safe Printf Libraries

Embedded systems use specialized printf implementations with no dynamic allocation:

- [mpaland/printf](https://github.com/mpaland/printf) — Tiny, no dynamic allocation, designed for embedded
- [eyalroz/printf](https://github.com/eyalroz/printf) — Maintained fork with improvements

> "This is a tiny but fully loaded printf, sprintf and (v)snprintf implementation, primarily designed for usage in embedded systems, where printf is not available due to memory issues or in avoidance of linking against libc."
> — [mpaland/printf](https://github.com/mpaland/printf)

### The Trade-off: Waste Memory, Gain Safety

The honest truth about static allocation:

| Approach           | Memory Efficiency | Safety    | Flexibility |
| ------------------ | ----------------- | --------- | ----------- |
| Dynamic (`malloc`) | High              | Dangerous | High        |
| Fixed max-size     | Low (wasteful)    | Safe      | Low         |
| Pool allocator     | Medium            | Safe      | Medium      |

**In safety-critical systems, you accept the memory waste** because:

1. The alternative is non-determinism and potential crashes
2. Memory is cheap; human lives are not
3. You can calculate exact worst-case memory usage at compile time
4. Certification requires proving memory bounds

### Key Insight for C-Next

> **"Dynamic" in embedded usually means "variable content in fixed container", not "variable container size."**

A UART buffer doesn't grow and shrink — it's always 256 bytes. The _content_ varies (5 bytes received, then 100, then 12), but the _container_ is fixed.

This suggests C-Next should provide bounded collection types:

```
// Bounded string type (like Ada, like Rust's heapless::String)
String<64> errorMsg;           // Always uses 64 bytes, stores up to 63 chars + null

// Circular buffer with compile-time size
CircularBuffer<u8, 256> uartRxBuffer;

// Fixed-capacity vector
Vec<SensorReading, 100> readings;  // Max 100 readings, always uses space for 100
```

These would be allocated in `init()` or statically, with the memory footprint known at compile time.

---

## Research: Developer Pain Points

### What Developers Find Difficult

> "Static allocation is usually faster and safer... However, static allocation also has some drawbacks, such as wasting memory if the allocated size is larger than needed, or limiting flexibility if the allocated size is smaller than needed."
> — [LinkedIn: Memory Allocation Best Practices](https://www.linkedin.com/advice/0/what-best-practices-memory-allocation-deallocation-lojpf)

> "In C++, dynamic memory allocation is core to many standard library containers: strings, vectors, maps. The Arduino String also uses dynamic memory."
> — [TrebledJ: Why Dynamic Memory Allocation Bad for Embedded](https://trebledj.me/posts/dynamic-memory-embedded-bad/)

**Common Complaints:**

1. Must know maximum sizes upfront
2. Wastes memory with worst-case allocations
3. Hard to support user-generated content / plugins
4. Strings are painful without dynamic allocation
5. Recursive data structures (trees, graphs) are awkward

---

## Initial Design Direction

Based on the research, the user proposes:

### The `init()` Pattern

```
// Global allocations ONLY allowed in init()
void init() {
    // These allocate from a startup memory pool
    txBuffer <- Buffer[1024];
    rxBuffer <- Buffer[1024];
    sensorReadings <- f32[100];
}

void main() {
    init();  // Must be called first, directly from main

    // After init(), no more global allocations allowed
    // Only stack-based, compile-time-determinable allocations
}

void processData() {
    // OK: Stack allocation, size known at compile time
    temp <- u8[64];

    // ERROR: Cannot allocate global/heap memory outside init()
    // buffer <- Buffer[size];  // size not known at compile time
}
```

### Key Properties

1. **All "dynamic" allocation happens at startup** — Matches MISRA best practice
2. **After init(), memory layout is fixed** — No fragmentation, no OOM
3. **Local variables are stack-based** — Automatically reclaimed
4. **Compile-time size checking** — Arrays must have constant sizes outside init()

---

## Open Questions (Research Needed)

### Q1: How should init() be enforced?

Options:

- a) Compiler requires `init()` to be first call in `main()`
- b) `init()` is implicitly called before `main()` (like C++ static constructors)
- c) Special `@startup` annotation for functions that can allocate

### Q2: What about variable-length data?

If a UART receives messages of varying length (up to 256 bytes), how should this be handled?

- a) Always allocate max size (256 bytes) — wastes memory
- b) Pool of fixed-size buffers
- c) Allow bounded dynamic allocation with compile-time max

### Q3: How to handle strings?

Strings are notoriously variable-length. Options:

- a) Fixed-capacity strings (like Rust's `heapless::String<N>`)
- b) Interned strings (allocated at init)
- c) Different rules for strings

### Q4: What about desktop/server applications?

The user notes:

> "This is a feature unique to embedded development... something that would need adjusted to use c-next for, say, a CLI application for a linux desktop that handled videos."

Options:

- a) Different "profiles" (embedded-strict vs desktop-relaxed)
- b) Explicit opt-in to dynamic allocation (`unsafe` block equivalent)
- c) Always require explicit allocator (Zig style)

### Q5: How granular should init() be?

Should subsystems have their own init?

```
void main() {
    CanBus.init();    // Allocates CAN buffers
    Console.init();   // Allocates console buffers
    Sensors.init();   // Allocates sensor arrays

    // Now all init is done, run the main loop
    while (true) { ... }
}
```

### Q6: Arduino Integration — How does setup()/loop() map?

Arduino's model maps naturally to the MISRA static allocation pattern:

```
┌─────────────────────────────────────────────────────┐
│  COMPILE TIME: Memory reserved (global declarations) │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  setup(): Configure pre-allocated resources          │
│  - Assign pointers, set baud rates, init peripherals │
│  - No new memory allocated, just configured          │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  loop(): Runtime - zero allocation                   │
│  - Use what was configured in setup()                │
└─────────────────────────────────────────────────────┘
```

**Key insight:** `setup()` isn't where allocation happens — it's where _configuration_ happens. The memory is already reserved at compile time via global declarations.

Example in C-Next:

```
// Memory reserved at compile time (global scope)
RingBuffer<u8, 256> serialRxBuffer;
RingBuffer<u8, 256> serialTxBuffer;

namespace Console {
    private UART* uart;

    void init(UART* u) {
        uart <- u;  // Just pointer assignment, no allocation
    }

    void print(const char* msg) { ... }
}

// Arduino entry points
void setup() {
    Serial.begin(115200);
    Console.init(&Serial);
}

void loop() {
    // All memory already exists - just use it
    Console.print("Hello");
    serialRxBuffer.push(Serial.read());
}
```

This is how well-written embedded C already works. Arduino's `String` class is the footgun — it heap-allocates in `loop()`. C-Next simply wouldn't have that option.

**Transpilation note:** Even scoped variables like `Console.uart` become globals in the generated C (`Console_uart`). C-Next enforces the `private` visibility at compile time, but the generated C uses `static` for file-level privacy. The safety is enforced by C-Next's compiler, not the C output.

### Q7: Memory pools — language feature or library?

Should C-Next provide built-in pool types?

```
Pool<Message, 32> messagePool;  // Pool of 32 Message-sized blocks
```

Or is this better as a library pattern?

### Q7: How to report allocation failures at init()?

If init() runs out of memory, what happens?

- a) Compile-time error (if sizes are static)
- b) Runtime panic (fail-fast)
- c) Return error code from init()

---

## Next Steps

1. **Research more real-world embedded codebases** — How do FreeRTOS, Zephyr, etc. handle this?
2. **Prototype the init() pattern** — Try implementing in current C projects
3. **Survey embedded developers** — What do they find most painful about static allocation?
4. **Evaluate Zig's approach** — Is explicit allocator parameter better than init()?
5. **Design bounded collections** — Like Rust's heapless, but for C-Next

---

## References

### Safety Standards

- [MISRA C:2023 Dir 4.12](https://www.mathworks.com/help/bugfinder/ref/misrac2023dir4.12.html) — Dynamic memory allocation prohibition
- [MISRA Forum: Dynamic Allocation Rule 20.4](https://forum.misra.org.uk/archive/index.php?thread-928.html=)
- [Wind River: DO-178C](https://www.windriver.com/solutions/learning/do-178c) — Aerospace software certification
- [SonarSource: Dynamic heap memory allocation should not be used](https://rules.sonarsource.com/c/rspec-984/)

### Real-World Failures

- [Hackaday: Toyota's Code Didn't Meet Standards](https://hackaday.com/2016/10/24/toyotas-code-didnt-meet-standards-and-might-have-led-to-death/)
- [EDN: Toyota's Killer Firmware](https://www.edn.com/toyotas-killer-firmware-bad-design-and-its-consequences/)
- [Barr Group: Top 10 Causes of Nasty Firmware Bugs](https://barrgroup.com/embedded-systems/how-to/top-ten-nasty-firmware-bugs)
- [Embedded Artistry: Historical Software Accidents](https://embeddedartistry.com/fieldatlas/historical-software-accidents-and-errors/)
- [Ganssle: Disaster!](https://www.ganssle.com/articles/disaster.htm)

### Language Approaches

- [Rust heapless crate](https://docs.rs/heapless/latest/heapless/)
- [The Embedded Rust Book: Collections](https://docs.rust-embedded.org/book/collections/)
- [AdaCore: Safe Dynamic Memory Management in Ada and SPARK](https://www.adacore.com/papers/safe-dynamic-memory-management-in-ada-and-spark)
- [AdaCore: Dynamic Storage Management Guidelines](https://learn.adacore.com/courses/Guidelines_for_Safe_and_Secure_Ada_SPARK/chapters/guidelines/dynamic_storage_management.html)
- [Zig: Why Zig](https://ziglang.org/learn/why_zig_rust_d_cpp/)
- [Zig Guide: Allocators](https://zig.guide/standard-library/allocators/)
- [matklad: Static Allocation For Compilers](https://matklad.github.io/2025/12/23/static-allocation-compilers.html) — TigerBeetle approach

### Allocation Patterns

- [Ryan Fleury: Untangling Lifetimes: The Arena Allocator](https://www.rfleury.com/p/untangling-lifetimes-the-arena-allocator)
- [gingerbill: Memory Allocation Strategies](https://www.gingerbill.org/article/2019/02/08/memory-allocation-strategies-002/)
- [Wikipedia: Region-based memory management](https://en.wikipedia.org/wiki/Region-based_memory_management)
- [Medium: Pool Memory Allocator in C](https://medium.com/@learn_aryan/pool-memory-allocator-in-c-embedded-systems-22e9f1d0026e)
- [embedded-code-patterns: Memory Pool](https://embedded-code-patterns.readthedocs.io/en/latest/pool/)

### Game Engine Memory Management

- [Jennifer Chukwu: Memory Management in Game Engines](https://jenniferchukwu.com/posts/memory)
- [Isetta Engine: Memory](https://isetta.io/compendium/Memory/)
- [Game Developer: Writing a Game Engine - Part 2: Memory](https://www.gamedeveloper.com/programming/writing-a-game-engine-from-scratch---part-2-memory)

### Developer Experience

- [TrebledJ: Why Dynamic Memory Allocation Bad for Embedded](https://trebledj.me/posts/dynamic-memory-embedded-bad/)
- [LinkedIn: Memory Allocation Best Practices](https://www.linkedin.com/advice/0/what-best-practices-memory-allocation-deallocation-lojpf)

### UART and Serial Communication

- [MaJerle: STM32 USART DMA RX/TX](https://github.com/MaJerle/stm32-usart-uart-dma-rx-tx) — Comprehensive DMA examples
- [DeepBlue Embedded: STM32 UART IDLE Line Detection](https://deepbluembedded.com/stm32-uart-receive-unknown-length-idle-line-detection-examples/)
- [ControllersTech: Ring Buffer with Head-Tail](https://controllerstech.com/ring-buffer-using-head-and-tail-in-stm32/)
- [Simply Embedded: UART Receive Buffering](http://www.simplyembedded.org/tutorials/interrupt-free-ring-buffer/)

### Automotive Standards

- [AUTOSAR CAN Transport Layer Specification](https://www.autosar.org/fileadmin/standards/R21-11/CP/AUTOSAR_SWS_CANTransportLayer.pdf)
- [AUTOSAR CAN Interface Specification](https://www.autosar.org/fileadmin/standards/R22-11/CP/AUTOSAR_SWS_CANInterface.pdf)

### String Handling

- [AdaCore: Standard Library Strings](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_strings.html) — Bounded strings in Ada
- [Feabhas: Working with Strings in Embedded C++](https://blog.feabhas.com/2022/02/working-with-strings-in-embedded-c/)
- [Embedded Artistry: std::string vs C-strings](https://embeddedartistry.com/blog/2017/07/26/stdstring-vs-c-strings/)
- [mpaland/printf](https://github.com/mpaland/printf) — Embedded-safe printf implementation
- [eyalroz/printf](https://github.com/eyalroz/printf) — Maintained fork with improvements
- [Ganssle: Sprintf is Very Dangerous](https://www.ganssle.com/rants/avoid_sprintf_in_c_code.html)
