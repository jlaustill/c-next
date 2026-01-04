# ADR-008: Language-Level Bug Prevention

**Status:** Research
**Date:** 2025-12-26
**Decision Makers:** C-Next Language Design Team

## Context

Every programming language has its "top 10" common bugs — patterns that developers repeatedly fall into despite experience and best intentions. C-Next's design philosophy is to **make these bugs impossible by construction** rather than catching them with warnings or runtime checks.

This document catalogs the most common and dangerous bugs in low-level/embedded languages (C, C++, Rust, Ada) and maps each to C-Next's prevention strategy. The goal: if a bug class has plagued embedded developers for decades, C-Next should structurally eliminate it.

> **Design Principle:** Safety through removal, not addition. If Linus Torvalds wouldn't approve of the complexity, it doesn't ship.

---

## Research Methodology

This analysis draws from:

- [CWE Top 25 Most Dangerous Software Weaknesses (2024)](https://cwe.mitre.org/top25/archive/2024/2024_cwe_top25.html)
- [MISRA C:2012 Guidelines](https://www.misra.org.uk/)
- [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard)
- [Barr Group: Top 10 Causes of Nasty Embedded Software Bugs](https://barrgroup.com/embedded-systems/how-to/top-ten-nasty-firmware-bugs)
- Industry incident reports and CVE analysis
- Microsoft Security Response Center data (70% of CVEs are memory safety issues)

---

## The Top 10 Embedded Bug Categories

### 1. Buffer Overflow / Out-of-Bounds Write

**Severity:** Critical | **CWE-787** (Rank #2 in 2024)

**What it is:** Writing data beyond the allocated bounds of an array or buffer, corrupting adjacent memory.

**C Example (Bug):**

```c
char buffer[10];
strcpy(buffer, user_input);  // No bounds checking!
```

**Why it happens:**

- C arrays don't carry size information
- Functions like `strcpy`, `strcat`, `sprintf` don't check bounds
- Manual index calculations are error-prone
- Off-by-one errors in loop bounds

**Industry Impact:**

- Buffer overflows are [the most common attack vector in embedded systems](https://www.freecodecamp.org/news/how-to-debug-and-prevent-buffer-overflows-in-embedded-systems)
- Constrained embedded systems often lack ASLR/DEP protections
- [MISRA C Rule 18.1](https://www.mathworks.com/help/bugfinder/misra-c-2012-reference.html): "A pointer shall not point past the end of an array"

**C-Next Prevention Strategy:**

| Mechanism                      | How it Prevents                                                                |
| ------------------------------ | ------------------------------------------------------------------------------ |
| **Bounds-checked arrays**      | All array accesses validated at compile-time where possible, runtime otherwise |
| **Array size as part of type** | `u8 buffer[10]` carries the `10` as type information                           |
| **Safe string operations**     | No `strcpy` — use length-aware operations only                                 |
| **Range-based iteration**      | `for item in array` instead of manual indexing                                 |

```
// C-Next: Compile-time error if provably out of bounds
u8 buffer[10];
buffer[10] <- 5;  // ERROR: Index 10 out of bounds for size 10

// Runtime check for dynamic indices
i32 idx <- getUserInput();
buffer[idx] <- 5;  // Runtime bounds check inserted
```

---

### 2. Use-After-Free / Dangling Pointers

**Severity:** Critical | **CWE-416** (Rank #7 in 2024)

**What it is:** Accessing memory after it has been freed, leading to undefined behavior or exploitable vulnerabilities.

**C Example (Bug):**

```c
int* ptr = malloc(sizeof(int));
*ptr = 42;
free(ptr);
*ptr = 100;  // Use after free!
```

**Why it happens:**

- Manual memory management requires tracking allocation lifetimes
- Complex control flow makes it hard to know if memory is still valid
- Pointer aliasing (multiple pointers to same memory)

**Industry Impact:**

- [Microsoft: 70% of CVEs are memory safety issues](https://msrc-blog.microsoft.com/2019/07/16/a-proactive-approach-to-more-secure-code/)
- Use-after-free is a [top exploitation target](https://krishnag.ceo/blog/2024-cwe-top-25-most-dangerous-software-weaknesses-use-after-free-cwe-416/)

**C-Next Prevention Strategy:**

| Mechanism                   | How it Prevents                                           |
| --------------------------- | --------------------------------------------------------- |
| **No dynamic allocation**   | `malloc`/`free` don't exist — nothing to free incorrectly |
| **Static allocation only**  | All memory has program lifetime — no dangling possible    |
| **No pointer reassignment** | Addresses are fixed, eliminating aliasing bugs            |

```
// C-Next: No malloc, no free, no problem
u8 buffer[256];  // Static allocation, lives forever
// buffer is ALWAYS valid for the program's lifetime
```

**See also:** [ADR-003: Static Allocation](adr-003-static-allocation.md)

---

### 3. Null Pointer Dereference

**Severity:** High | **CWE-476** (Rank #12 in 2024)

**What it is:** Attempting to access memory through a null pointer, causing crashes or undefined behavior.

**C Example (Bug):**

```c
char* ptr = NULL;
if (some_condition) {
    ptr = get_string();
}
printf("%s", ptr);  // Might be NULL!
```

**Why it happens:**

- Forgetting to check return values from functions that can fail
- Complex initialization paths
- [MITRE lists null pointer as one of the most commonly exploited weaknesses](https://cwe.mitre.org/data/definitions/476.html)

**Industry Impact:**

- Causes crashes in production systems
- In embedded systems without memory protection, can corrupt arbitrary memory

**C-Next Prevention Strategy:**

| Mechanism                             | How it Prevents                                    |
| ------------------------------------- | -------------------------------------------------- |
| **Mandatory initialization**          | Variables must be initialized at declaration       |
| **No null pointers**                  | The concept of "null" doesn't exist for references |
| **Optional types for "maybe" values** | Use `Option<T>` when absence is meaningful         |

```
// C-Next: Mandatory initialization
i32 value;              // ERROR: Must initialize
i32 value <- 0;         // OK

// Option type for values that might not exist
Option<i32> maybeValue <- None;
if (condition) {
    maybeValue <- Some(42);
}
// Must explicitly handle the None case
match maybeValue {
    Some(v) => Console.print(v);
    None => Console.print("No value");
}
```

**Future ADR:** Option types and nullable handling

---

### 4. Assignment vs. Comparison Confusion

**Severity:** High | **CWE-481**

**What it is:** Using `=` (assignment) when `==` (comparison) was intended, or vice versa.

**C Example (Bug):**

```c
if (x = 5) {  // Always true, also modifies x!
    // ...
}
```

**Why it happens:**

- Single keystroke difference
- Both are syntactically valid
- Hard to spot in code review

**Industry Impact:**

- [MISRA C:2012 Rule 13.4](https://pvs-studio.com/en/docs/warnings/v2561/): "The result of an assignment operator should not be used"
- [SEI CERT EXP45-C](https://wiki.sei.cmu.edu/confluence/display/c/EXP45-C.+Do+not+perform+assignments+in+selection+statements): "Do not perform assignments in selection statements"

**C-Next Prevention Strategy:**

| Mechanism                        | How it Prevents                              |
| -------------------------------- | -------------------------------------------- |
| **`<-` for assignment**          | Visually distinct from comparison            |
| **`=` for comparison**           | Matches mathematical notation                |
| **No assignment in expressions** | Assignment is a statement, not an expression |

```
// C-Next: Impossible to confuse
x <- 5;         // Assignment: value flows INTO x
if (x = 5) {    // Comparison: single equals, like math
    // ...
}

// This is a syntax error:
if (x <- 5) {   // ERROR: Assignment not allowed in condition
```

**See also:** [ADR-001: Assignment Operator](adr-001-assignment-operator.md)

---

### 5. Integer Overflow / Wraparound

**Severity:** High | **CWE-190** (Rank #14 in 2024)

**What it is:** Arithmetic operation exceeds the range of the integer type, silently wrapping around or producing unexpected results.

**C Example (Bug):**

```c
uint8_t counter = 255;
counter++;  // Silently wraps to 0!

int16_t big = 30000;
int16_t result = big + big;  // Overflow! Undefined behavior for signed
```

**Why it happens:**

- C silently wraps unsigned integers
- Signed overflow is undefined behavior (compiler can do anything)
- [Attackers exploit wraparound in size calculations](https://developer.apple.com/library/archive/documentation/Security/Conceptual/SecureCodingGuide/Articles/BufferOverflows.html)

**Industry Impact:**

- Size calculation vulnerabilities lead to buffer overflows
- Counter wraparounds cause timing/logic bugs in embedded systems

**C-Next Prevention Strategy:**

| Mechanism                        | How it Prevents                          |
| -------------------------------- | ---------------------------------------- |
| **Explicit overflow handling**   | Choose behavior: trap, wrap, or saturate |
| **Compile-time range analysis**  | Detect provable overflows statically     |
| **Saturating arithmetic option** | `255 +sat 1 = 255` for counters          |

```
// C-Next: Explicit overflow semantics
u8 counter <- 255;

counter <- counter + 1;           // Default: trap (panic) on overflow
counter <- counter +wrap 1;       // Explicit wrap: becomes 0
counter <- counter +sat 1;        // Saturate: stays at 255

// For safety-critical, trap is the default
// Developer must explicitly opt into other behaviors
```

**Future ADR:** Overflow semantics and checked arithmetic

---

### 6. Uninitialized Variables

**Severity:** High | **CWE-824**

**What it is:** Reading from a variable before it has been assigned a value.

**C Example (Bug):**

```c
int value;
if (condition) {
    value = 10;
}
printf("%d", value);  // Uninitialized if condition was false!
```

**Why it happens:**

- C allows declaration without initialization
- Complex control flow obscures initialization paths
- Stack memory contains garbage from previous calls

**Industry Impact:**

- [Unpredictable behavior, especially in embedded systems where memory isn't zeroed](https://www.sanfoundry.com/c-tutorials-uninitialized-illegal-pointer-indirection-illegal-pointer/)
- Security vulnerabilities from information leakage
- Intermittent bugs that are hard to reproduce

**C-Next Prevention Strategy:**

| Mechanism                    | How it Prevents                                 |
| ---------------------------- | ----------------------------------------------- |
| **Mandatory initialization** | Every variable must have an initial value       |
| **Compiler flow analysis**   | Error if any path leaves variable uninitialized |

```
// C-Next: Mandatory initialization
i32 value;                    // ERROR: Must initialize
i32 value <- 0;               // OK

// Compiler tracks initialization through all paths
i32 result;
if (condition) {
    result <- 10;
}
Console.print(result);        // ERROR: result not initialized on all paths

// Must cover all cases
i32 result;
if (condition) {
    result <- 10;
} else {
    result <- 0;
}
Console.print(result);        // OK: initialized on all paths
```

---

### 7. Race Conditions

**Severity:** Critical | **CWE-362** (Recently dropped from Top 25 but still critical for embedded)

**What it is:** Multiple threads or interrupt handlers access shared data without proper synchronization, leading to unpredictable behavior.

**C Example (Bug):**

```c
volatile int counter = 0;

// In main thread
counter++;

// In ISR
counter++;

// Race! Increment is not atomic
```

**Why it happens:**

- Shared mutable state between tasks/interrupts
- `volatile` doesn't provide atomicity
- Forgetting to disable interrupts during critical sections
- [Mars Pathfinder priority inversion incident (1997)](https://barrgroup.com/embedded-systems/how-to/top-ten-nasty-firmware-bugs)

**Industry Impact:**

- Intermittent failures that are nearly impossible to reproduce
- Can cause safety-critical system failures
- Priority inversion can miss real-time deadlines

**C-Next Prevention Strategy:**

| Mechanism                              | How it Prevents                              |
| -------------------------------------- | -------------------------------------------- |
| **No shared mutable state by default** | Data is owned by one context                 |
| **Explicit atomic operations**         | `atomic<T>` types with defined semantics     |
| **Structured concurrency**             | Task/ISR communication through safe channels |

```
// C-Next: Shared data requires explicit atomic wrapper
atomic<u32> counter <- 0;

// In any context - atomic operations
counter.increment();
counter.store(value);
u32 current <- counter.load();

// Or use message passing
Channel<Message> taskChannel;
taskChannel.send(msg);  // Safe cross-task communication
```

**Future ADR:** Concurrency model and atomic types

---

### 8. Off-by-One Errors (Fencepost Errors)

**Severity:** Medium-High | **CWE-193**

**What it is:** Loop iterates one too many or too few times, or array index is off by one.

**C Example (Bug):**

```c
// Iterate over 10 elements
for (int i = 0; i <= 10; i++) {  // Should be < 10!
    array[i] = 0;  // Writes 11 elements!
}

// String buffer
char buffer[10];
strncpy(buffer, source, 10);  // Might not null-terminate!
```

**Why it happens:**

- Confusion between `<` and `<=` in loop conditions
- [Zero-based indexing confusion](https://en.wikipedia.org/wiki/Off-by-one_error)
- `strncpy` doesn't null-terminate if source is too long
- Fencepost problem: "n items need n+1 fenceposts"

**Industry Impact:**

- Common cause of buffer overflows
- [strncat misuse writes one byte beyond max length](https://en.wikipedia.org/wiki/Off-by-one_error)

**C-Next Prevention Strategy:**

| Mechanism                  | How it Prevents                                       |
| -------------------------- | ----------------------------------------------------- |
| **Range-based iteration**  | `for item in array` — no manual bounds                |
| **Inclusive range syntax** | `for i in 0..9` is clear about bounds                 |
| **Length-aware strings**   | String type carries length, no null-terminator tricks |
| **Bounds checking**        | Array access checked at compile/runtime               |

```
// C-Next: Range-based iteration (no off-by-one possible)
u8 array[10];
for item in array {
    item <- 0;  // Exactly 10 iterations
}

// Explicit ranges with clear semantics
for i in 0..<10 {    // 0 to 9 (exclusive end)
    array[i] <- 0;
}

for i in 0..=9 {     // 0 to 9 (inclusive end)
    array[i] <- 0;
}
```

---

### 9. Memory Leaks

**Severity:** High (especially in embedded)

**What it is:** Allocated memory is never freed, gradually consuming all available RAM.

**C Example (Bug):**

```c
void process() {
    char* buffer = malloc(1024);
    if (error) {
        return;  // Leak! buffer never freed
    }
    // ... use buffer ...
    free(buffer);
}
```

**Why it happens:**

- Complex control flow with multiple exit points
- Error handling paths forget to free
- Losing the pointer to allocated memory

**Industry Impact:**

- Embedded systems run for years without restart
- [Eventually exhausts memory, system fails in unpredictable ways](https://barrgroup.com/embedded-systems/how-to/most-common-embedded-software-bugs)
- Often NULL is returned by malloc and caller proceeds to corrupt memory

**C-Next Prevention Strategy:**

| Mechanism                    | How it Prevents                                             |
| ---------------------------- | ----------------------------------------------------------- |
| **No dynamic allocation**    | `malloc` doesn't exist — can't leak what you don't allocate |
| **Static allocation only**   | All memory is allocated at compile time or startup          |
| **Pool allocators (future)** | If dynamic needed, use managed pools with clear ownership   |

```
// C-Next: Static allocation only
u8 buffer[1024];  // Always exists, never leaked

// For variable-size needs: pools (future feature)
Pool<Message, 32> messagePool;
Message msg <- messagePool.acquire();
// ... use msg ...
messagePool.release(msg);  // Return to pool (not freed)
```

**See also:** [ADR-003: Static Allocation](adr-003-static-allocation.md)

---

### 10. Type Confusion / Implicit Conversions

**Severity:** Medium-High

**What it is:** Implicit type conversions produce unexpected values, especially when mixing signed/unsigned or different sizes.

**C Example (Bug):**

```c
uint8_t small = 200;
int8_t signed_val = small;  // Becomes -56!

unsigned int u = 1;
int s = -2;
if (s < u) {  // FALSE! s becomes huge unsigned value
    // This branch is NOT taken!
}
```

**Why it happens:**

- C's integer promotion and conversion rules are complex
- Mixing signed and unsigned in comparisons
- Implicit narrowing conversions lose data

**Industry Impact:**

- [MISRA C Rules 10.x](https://www.codeant.ai/blogs/misra-c-2012-rules-examples-pdf) address essential type conversions
- Common source of security vulnerabilities in size calculations

**C-Next Prevention Strategy:**

| Mechanism                            | How it Prevents                         |
| ------------------------------------ | --------------------------------------- |
| **No implicit conversions**          | All conversions must be explicit        |
| **Fixed-width types only**           | `i8`, `u16`, `i32` — no ambiguous `int` |
| **Signed/unsigned comparison error** | Mixing requires explicit cast           |

```
// C-Next: Explicit conversions required
u8 small <- 200;
i8 signed_val <- small;           // ERROR: Potential data loss

i8 signed_val <- i8(small);       // ERROR: Value 200 exceeds i8 range
i8 signed_val <- i8.truncate(small);  // OK: Explicit truncation

// Signed/unsigned comparison
u32 u <- 1;
i32 s <- -2;
if (s < u) {                      // ERROR: Cannot compare signed/unsigned
    // ...
}
if (s < i32(u)) {                 // OK: Explicit conversion
    // ...
}
```

---

## Additional High-Risk Bug Categories

### 11. Missing Volatile Keyword

**Embedded-Specific**

**What it is:** Compiler optimizes away reads/writes to hardware registers or shared variables.

**C Example (Bug):**

```c
int* status_reg = (int*)0x40000000;
while (*status_reg == 0) {  // Compiler might read once and loop forever!
    // wait
}
```

**C-Next Prevention:**

- Register bindings are automatically volatile
- Shared variables require explicit `volatile` or `atomic`

**See also:** [ADR-004: Register Bindings](adr-004-register-bindings.md)

---

### 12. Stack Overflow

**Embedded-Specific**

**What it is:** Function calls and local variables exceed the limited stack space.

**C Example (Bug):**

```c
void recursive(int n) {
    char big_buffer[1024];  // Stack allocation!
    recursive(n + 1);       // Infinite recursion!
}
```

**C-Next Prevention:**

- Static allocation means large buffers don't go on stack
- Recursion could be limited or require explicit opt-in
- Stack usage analysis at compile time (future)

---

### 13. Pointer Arithmetic Errors

**What it is:** Incorrect pointer math leads to accessing wrong memory.

**C Example (Bug):**

```c
int arr[10];
int* ptr = arr;
ptr += 20;      // Points outside array!
*ptr = 42;      // Undefined behavior
```

**C-Next Prevention:**

- No pointer arithmetic — use array indexing with bounds checks
- [MISRA C Rule 18.4](https://www.mathworks.com/help/bugfinder/misra-c-2012-reference.html): "Pointer arithmetic shall not be performed"

**See also:** [ADR-006: Simplified References](adr-006-simplified-references.md)

---

### 14. Format String Vulnerabilities

**What it is:** User input used as format string allows reading/writing arbitrary memory.

**C Example (Bug):**

```c
printf(user_input);  // If user_input is "%s%s%s%s", crash!
```

**C-Next Prevention:**

- Type-safe printing: `Console.print(value)` — no format strings
- String interpolation at compile time: `f"Value is {value}"`

---

### 15. Deadlocks

**Embedded-Specific (RTOS)**

**What it is:** Two tasks each hold a resource the other needs, neither can proceed.

**C-Next Prevention:**

- Structured concurrency with clear resource ownership
- Lock ordering enforced by type system (future)
- Prefer message passing over shared locks

---

## Summary: C-Next Bug Prevention Matrix

| Bug Category         | CWE | C-Next Prevention           | ADR                                     |
| -------------------- | --- | --------------------------- | --------------------------------------- |
| Buffer Overflow      | 787 | Bounds-checked arrays       | Future                                  |
| Use-After-Free       | 416 | Static allocation only      | [003](adr-003-static-allocation.md)     |
| Null Dereference     | 476 | Mandatory init, no null     | Future                                  |
| Assignment Confusion | 481 | `<-` vs `=` operators       | [001](adr-001-assignment-operator.md)   |
| Integer Overflow     | 190 | Explicit overflow semantics | Future                                  |
| Uninitialized Vars   | 824 | Mandatory initialization    | Future                                  |
| Race Conditions      | 362 | No shared mutable state     | Future                                  |
| Off-by-One           | 193 | Range-based iteration       | Future                                  |
| Memory Leaks         | N/A | Static allocation only      | [003](adr-003-static-allocation.md)     |
| Type Confusion       | N/A | No implicit conversions     | Future                                  |
| Missing Volatile     | N/A | Auto-volatile registers     | [004](adr-004-register-bindings.md)     |
| Stack Overflow       | N/A | Static allocation           | [003](adr-003-static-allocation.md)     |
| Pointer Arithmetic   | N/A | No pointer arithmetic       | [006](adr-006-simplified-references.md) |
| Format Strings       | 134 | Type-safe printing          | Future                                  |
| Deadlocks            | 362 | Structured concurrency      | Future                                  |

---

## Comparison with Other Languages

### How Rust Prevents These Bugs

Rust addresses many of these through:

- Ownership and borrowing (use-after-free, data races)
- Option/Result types (null safety)
- Bounds checking (buffer overflows)
- Explicit overflow handling

**Trade-off:** Significant learning curve with lifetimes, borrow checker, `Box<dyn Trait>`.

### How Ada/SPARK Prevents These Bugs

Ada/SPARK addresses through:

- Strong typing with range constraints
- Formal verification (SPARK subset)
- Runtime checks by default

**Trade-off:** Verbose syntax, smaller ecosystem.

### C-Next's Approach

C-Next takes a **removal-based approach:**

> "Remove the ability to make errors rather than add concepts to catch them."

| Approach       | Rust           | Ada            | C-Next            |
| -------------- | -------------- | -------------- | ----------------- |
| Memory safety  | Borrow checker | Runtime checks | Static allocation |
| Null safety    | Option type    | Constraints    | Mandatory init    |
| Learning curve | Steep          | Moderate       | Minimal           |
| Escape hatch   | `unsafe`       | Pragmas        | Clean C output    |

---

## Implementation Priorities

Based on severity and frequency, implementation priority:

### Phase 1: Foundational (Already In Progress)

1. ✅ Assignment operator (`<-` vs `=`) — ADR-001
2. ✅ Static allocation only — ADR-003
3. ✅ No pointer syntax — ADR-006

### Phase 2: Type Safety

4. Mandatory initialization
5. No implicit type conversions
6. Fixed-width types only

### Phase 3: Array Safety

7. Bounds-checked arrays
8. Range-based iteration
9. Safe string operations

### Phase 4: Arithmetic Safety

10. Explicit overflow handling
11. Saturating/wrapping arithmetic options

### Phase 5: Concurrency (If Needed)

12. Atomic types
13. Safe task/ISR communication

---

## Conclusion

C-Next can eliminate **entire categories of bugs** that have plagued embedded development for decades. By making these bugs structurally impossible rather than merely warned about, C-Next achieves safety without the complexity overhead of languages like Rust.

The key insight from Ada/SPARK: **defect rates are 10-100x lower** when the language prevents bugs by construction. C-Next aims to bring these benefits while maintaining C's simplicity and familiarity.

> "The best bug is one that's impossible to write."

---

## References

### Standards & Vulnerability Databases

- [CWE Top 25 (2024)](https://cwe.mitre.org/top25/archive/2024/2024_cwe_top25.html)
- [CISA: 2024 CWE Top 25 Advisory](https://www.cisa.gov/news-events/alerts/2024/11/20/2024-cwe-top-25-most-dangerous-software-weaknesses)
- [MISRA C:2012 Guidelines](https://www.misra.org.uk/)
- [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard)

### Embedded-Specific Resources

- [Barr Group: Top 10 Causes of Nasty Embedded Software Bugs](https://barrgroup.com/embedded-systems/how-to/top-ten-nasty-firmware-bugs)
- [Barr Group: Most Common Embedded Software Bugs](https://barrgroup.com/embedded-systems/how-to/most-common-embedded-software-bugs)
- [Embedded.com: Five Top Causes of Nasty Embedded Software Bugs](https://www.embedded.com/five-top-causes-of-nasty-embedded-software-bugs/)
- [FreeCodeCamp: Buffer Overflows in Embedded Systems](https://www.freecodecamp.org/news/how-to-debug-and-prevent-buffer-overflows-in-embedded-systems)

### Memory Safety Research

- [Microsoft Security: 70% of CVEs are Memory Safety](https://msrc-blog.microsoft.com/2019/07/16/a-proactive-approach-to-more-secure-code/)
- [Code Intelligence: Memory Safety Bugs](https://www.code-intelligence.com/blog/memory_safety_corruption)
- [Wikipedia: Memory Safety](https://en.wikipedia.org/wiki/Memory_safety)
- [White House: Memory Safe Languages (2024)](https://www.whitehouse.gov/oncd/briefing-room/2024/02/26/memory-safety-fact-sheet/)

### Language Comparisons

- [Ada, SPARK, and Rust in Embedded Programming](https://www.eenewseurope.com/en/exploring-ada-spark-rust-in-embedded-programming/)
- [Embedded Computing: Memory Safety in Ada, SPARK, and Rust](https://embeddedcomputing.com/technology/software-and-os/memory-safety-in-ada-spark-and-rust)
- [AdaCore: SPARK Defect Rates](https://www.adacore.com/about-spark)

### Specific Bug Categories

- [Wikipedia: Off-by-one Error](https://en.wikipedia.org/wiki/Off-by-one_error)
- [SEI CERT: Null Pointer Dereference](https://wiki.sei.cmu.edu/confluence/display/c/EXP34-C.+Do+not+dereference+null+pointers)
- [CWE-416: Use After Free](https://cwe.mitre.org/data/definitions/416.html)
- [CWE-476: NULL Pointer Dereference](https://cwe.mitre.org/data/definitions/476.html)
