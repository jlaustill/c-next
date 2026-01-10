# ADR-051: Division by Zero Detection

## Status

**Accepted**

## Context

Division by zero is a critical source of undefined behavior in C/C++ and a significant safety concern in embedded systems. C-Next currently transpiles division operations directly to C without any checks, inheriting C's undefined behavior.

### Current Behavior

```cnx
// C-Next input
u32 result <- 10 / 0;

// Generated C output (compiles with warning)
uint32_t result = 10 / 0;  // warning: division by zero [-Wdiv-by-zero]
```

**Runtime behavior:**
- x86/x86_64: Hardware exception (SIGFPE), program crash
- ARM Cortex-M: Returns 0 by default (unless DIV_0_TRP enabled), **silent corruption**
- Both cases: Undefined behavior per C standard

### The ARM Cortex-M Problem

Unlike x86 processors that trap on division by zero, [ARM Cortex-M processors return 0 by default](https://medium.com/@pqshedy33/why-doesnt-the-program-crash-when-the-stm32-microcontroller-performs-zero-division-operation-fe53bb97a697) without generating a fault. This means:

```c
uint32_t speed = distance / time;  // If time is 0, speed becomes 0 silently
motorControl(speed);                // Motor receives incorrect command
```

In safety-critical embedded systems (medical devices, automotive), this **silent data corruption** is more dangerous than a crash.

### MISRA C Requirements

[MISRA C:2012](https://wiki.sei.cmu.edu/confluence/display/c/MISRA+C:2012) addresses division by zero through:

- **Rule 1.3:** "There shall be no occurrence of undefined or critical unspecified behavior"
- **Directive 4.1:** "Run-time failures shall be minimized"

[Division by zero is listed among the most serious bugs](https://www.codeant.ai/blogs/misra-c-2012-rules-examples-pdf) arising from undefined behavior, alongside buffer overruns and use of uninitialized memory.

[MISRA recommends static analysis tools](https://www.parasoft.com/solutions/misra/) to detect division by zero violations.

---

## Research: How Other Languages Handle Division by Zero

### C and C++

**Behavior:** [Undefined behavior for integer division](https://www.geeksforgeeks.org/cpp/undefined-behavior-c-cpp/) (both signed and unsigned)

**Reality:** x86 crashes, behavior varies by processor

**Floating-point:** [Well-defined per IEEE 754](https://riptutorial.com/cplusplus/example/7411/integer-division-by-zero) (returns ±Inf or NaN)

**Detection:** GCC warning at compile-time for literals, [UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html) at runtime

### Rust

**Compile-time:** [Detects division by zero in constant expressions](https://github.com/rust-lang/rust/issues/37998), compilation fails

**Runtime:** [Integer division panics (SIGFPE)](https://microblog.desipenguin.com/post/rust-divide-by-zero/), crashes the program

**Floating-point:** [Returns Inf, does not panic](https://internals.rust-lang.org/t/should-x-0-be-an-error/2252)

**Safe alternative:** [CheckedDiv trait](https://docs.rs/num/latest/num/trait.CheckedDiv.html) returns `Option<T>` instead of panicking

**Philosophy:** ["Why does dividing by zero have no safety guarantees?"](https://internals.rust-lang.org/t/question-why-does-dividing-by-zero-have-no-safety-guarantees/19189) - Rust considers panic to be safe (controlled abort)

### Zig

**Compile-time:** [Detects literal division by zero](https://github.com/ziglang/zig/issues/372), returns compile error

**Runtime:** [Classified as "illegal behavior"](https://zig.guide/language-basics/runtime-safety/), checked in safe builds

**Safety modes:**
- Debug builds: [Runtime check, panics on division by zero](https://github.com/ziglang/zig/issues/149)
- Release-safe builds: Runtime check included
- Release-fast/small builds: Check omitted for performance (undefined behavior)

**Control:** [`@setRuntimeSafety(false)`](https://ziglang.org/documentation/master/) to disable checks in hot paths

**Philosophy:** [Uses "illegal behavior" as a tool for both bug prevention and performance](https://www.scattered-thoughts.net/writing/how-safe-is-zig/)

### Ada

**Runtime:** [Raises Constraint_Error exception](https://piembsystech.com/understanding-built-in-exceptions-in-ada-programming-language/) when division by zero occurs

**Safety-critical:** [Exception handlers allow graceful degradation](https://learn.adacore.com/courses/advanced-ada/parts/control_flow/exceptions.html) instead of abrupt termination

**Static analysis:** [SPARK/GNATprove can prove absence of division by zero](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html) at compile-time

**Philosophy:** Designed for hospital patient monitoring, aircraft fly-by-wire, nuclear control systems

### Swift

**Runtime:** [Division by zero causes a runtime trap, crashes the program](https://medium.com/@wircho/throwing-arithmetic-operators-in-swift-6c39fca4ff0e)

**Philosophy:** ["Trapping is safe"](https://numerics.diploid.ca/integers-part-2.html) - Swift traps on overflow, bounds errors, precondition failures

**Safe alternative:** [`dividedReportingOverflow(by:)`](https://github.com/swiftlang/swift/issues/54279) returns tuple with overflow flag

**Note:** [Overflow division operators &/ and &% were removed](https://forums.swift.org/t/division-and-prefix-minus-with-overflow/50195) in Swift 1.2

### Go

**Runtime:** [Panics with "runtime error: integer divide by zero"](https://labex.io/questions/how-does-go-handle-division-by-zero-166173), terminates program

**Floating-point:** [Returns ±Inf or NaN](https://www.brandongreeley.com/how-to-recover-from-panics-in-go/)

**Recovery:** [Can use defer + recover() to catch panic](https://labex.io/tutorials/go-how-to-prevent-integer-division-panic-437944)

**Philosophy:** Simple, predictable - panic on error

### Summary Table

| Language | Compile-Time Detection | Runtime Behavior | Safe Alternative |
|----------|------------------------|------------------|------------------|
| **C/C++** | Warning only | Undefined (crash on x86, silent on ARM) | UBSan runtime check |
| **Rust** | Error in const expr | Panic (crash) | `checked_div()` returns `Option<T>` |
| **Zig** | Error for literals | Panic in safe mode, UB in fast mode | Build mode control |
| **Ada** | Optional (SPARK) | Exception (catchable) | Exception handling |
| **Swift** | No | Trap (crash) | `dividedReportingOverflow(by:)` |
| **Go** | No | Panic (crash) | Manual check + error return |

---

## Options for C-Next

### Option A: No Detection (Status Quo)

**Current behavior** — Transpile directly to C, inherit undefined behavior.

```cnx
u32 result <- 10 / 0;  // Transpiles to: uint32_t result = 10 / 0;
```

**Pros:**
- Zero implementation cost
- Matches C behavior exactly
- No performance overhead

**Cons:**
- ❌ Violates MISRA Rule 1.3 (undefined behavior)
- ❌ Silent corruption on ARM Cortex-M (most C-Next target platforms)
- ❌ No safety improvement over C
- ❌ Literal division by zero is trivially detectable, yet uncaught

**Verdict:** Unacceptable for a "safer C" targeting embedded systems.

---

### Option B: Compile-Time Detection Only

Detect and reject division by zero when divisor is a **compile-time constant**.

```cnx
// Case 1: Literal zero - COMPILE ERROR
u32 result <- 10 / 0;
// Error: Division by zero

// Case 2: Const variable - COMPILE ERROR
const u32 DIVISOR <- 0;
u32 result <- 10 / DIVISOR;
// Error: Division by zero

// Case 3: Runtime variable - ALLOWED (no check)
u32 divisor <- getUserInput();
u32 result <- 10 / divisor;  // Undefined if divisor is 0
```

**Implementation:**
- Add semantic check in analysis phase
- Evaluate constant expressions
- Emit error if divisor evaluates to 0

**Pros:**
- ✅ Catches trivial bugs (typos, logic errors)
- ✅ Zero runtime overhead
- ✅ Simple implementation
- ✅ Aligns with Rust/Zig compile-time detection

**Cons:**
- ⚠️ Doesn't protect against runtime division by zero
- ⚠️ Partial solution only

**MISRA compliance:** Partial (catches some violations, not all)

---

### Option C: Runtime Checks (Always)

Insert runtime checks for **all** division/modulo operations.

```cnx
// C-Next input
u32 result <- numerator / denominator;

// Generated C
if (denominator == 0) {
    // Trap/abort/handler
    __cnx_division_by_zero_error();
}
uint32_t result = numerator / denominator;
```

**Handler options:**
- Call abort() or trap handler
- Set result to 0 and continue (silent error - BAD)
- Invoke user-defined error handler
- On ARM: Trigger UsageFault via `__builtin_trap()`

**Pros:**
- ✅ Complete protection against division by zero
- ✅ Works on ARM Cortex-M (fixes silent corruption)
- ✅ Full MISRA compliance

**Cons:**
- ❌ Performance overhead on every division
- ❌ Code size increase
- ❌ May be overkill for validated inputs
- ❌ Conflicts with C-Next's "zero-cost abstractions" philosophy

**Embedded implications:** In tight control loops, division is common (PID controllers, sensor fusion). Adding checks to every division could impact real-time performance.

---

### Option D: Compile-Time + Optional Runtime Checks

Combine Option B (always) with Option C (opt-in).

```cnx
// Case 1: Literal zero - COMPILE ERROR
u32 result <- 10 / 0;  // Error: Division by zero

// Case 2: Normal division - NO runtime check
u32 result <- numerator / divisor;  // Programmer responsible

// Case 3: Checked division - Runtime check
u32 result <- safe numerator / divisor;
// Generates: if (divisor == 0) abort();
```

**Alternative syntax:**
```cnx
// Built-in checked division function
u32 result <- checked_div(numerator, divisor);  // Aborts on zero
```

**Pros:**
- ✅ Catches trivial bugs at compile time
- ✅ Zero overhead by default
- ✅ Opt-in safety for critical paths
- ✅ Flexible for embedded constraints

**Cons:**
- ⚠️ Requires programmer discipline
- ⚠️ Extra syntax/built-in to learn
- ⚠️ Partial MISRA compliance (depends on usage)

---

### Option E: Require Explicit Checks (Compiler-Enforced)

Force programmers to prove divisor is non-zero via explicit check.

```cnx
// ERROR: Unchecked division
u32 result <- numerator / divisor;
// Error: Division requires prior non-zero check

// OK: Explicit check before division
if (divisor != 0) {
    u32 result <- numerator / divisor;  // Allowed in this scope
} else {
    // Handle error
}
```

**Flow-sensitive analysis:**
- Compiler tracks which variables have been checked
- Division only allowed after `!= 0` check in control flow
- Similar to Rust's ownership/borrow checker complexity

**Pros:**
- ✅ Forces correct handling
- ✅ No runtime overhead (check is already there)
- ✅ Excellent safety

**Cons:**
- ❌ Very complex to implement (flow analysis)
- ❌ Frustrating when divisor is known safe (e.g., constant 10)
- ❌ Overkill for C-Next's simplicity goals
- ❌ Requires sophisticated compiler

---

### Option F: Saturating Division (Return Sentinel Value)

On division by zero, return a defined sentinel value instead of undefined behavior.

```cnx
// C-Next input
u32 result <- numerator / 0;

// Generated C
uint32_t result = (denominator == 0) ? UINT32_MAX : (numerator / denominator);
```

**Pros:**
- ✅ Defined behavior (no UB)
- ✅ Works on ARM (fixes silent corruption)
- ✅ Fast (one comparison)

**Cons:**
- ❌ Hides bugs (program continues with wrong data)
- ❌ Not a real solution (0 vs UINT32_MAX are both wrong)
- ❌ Violates principle of least surprise
- ❌ Not how any other language handles this

**Verdict:** Creative but **not recommended**. Masking errors is worse than catching them.

---

## Decision

**Accepted: Option B (Compile-Time Detection) + safe_div() Built-in**

C-Next will implement a two-tier approach to division by zero safety:

### 1. Compile-Time Detection (Always Enabled)

Detect and reject division/modulo by zero when the divisor is a **compile-time constant**:

```cnx
// ❌ COMPILE ERROR
u32 result <- 10 / 0;
u32 remainder <- 10 % 0;

// ❌ COMPILE ERROR (const evaluates to zero)
const u32 ZERO <- 0;
u32 result <- 10 / ZERO;

// ❌ COMPILE ERROR (const expression)
const u32 VALUE <- 5 - 5;
u32 result <- 10 / VALUE;
```

**Error message:** `"Division by zero"`

### 2. Normal Division (Fast Path)

Standard division/modulo operators have **zero runtime overhead**:

```cnx
// ✅ Compiles (no runtime check)
u32 divisor <- getUserInput();
u32 result <- 10 / divisor;  // Fast, programmer responsible for validation
```

**Use case:** Time-critical control loops where every CPU cycle matters and the developer has validated inputs.

### 3. Safe Division Built-in (Opt-in Safety)

For safety-critical calculations, C-Next provides `safe_div()` and `safe_mod()` built-in functions:

```cnx
u32 speed <- 100;  // Current value
bool hadError <- safe_div(speed, distance, time, 100);
if (hadError) {
    logError("Division by zero in speed calculation");
}
// If time was 0, speed is now 100 (default)
// If time was non-zero, speed = distance / time
```

**Function signature (conceptual):**

```cnx
// Returns true if divisor was zero (used default), false if division succeeded
bool safe_div(output, numerator, divisor, defaultIfZero);
bool safe_mod(output, numerator, divisor, defaultIfZero);
```

**Generated C implementation (example for u32):**

```c
bool cnx_safe_div_u32(uint32_t* output, uint32_t numerator, uint32_t divisor, uint32_t defaultIfZero) {
    if (divisor == 0) {
        *output = defaultIfZero;
        return true;  // Error: used default
    }
    *output = numerator / divisor;
    return false;  // Success: performed division
}
```

**Type variants:** Generated for all integer types: `u8`, `u16`, `u32`, `u64`, `i8`, `i16`, `i32`, `i64`

**Use case:** Safety-critical calculations where the extra check is worth the cost and a sensible default exists.

---

## Rationale

### Why This Approach?

1. **Catches trivial bugs** — Literal division by zero (`10 / 0`) is always a programming error, caught at compile time
2. **Zero-cost by default** — Fast path has no overhead; critical for embedded real-time constraints
3. **Explicit opt-in safety** — Developers choose where to pay for runtime checks
4. **Sensible defaults** — `safe_div()` prevents ARM Cortex-M silent corruption with explicit fallback values
5. **Simple implementation** — Constant folding for compile-time, simple function for runtime
6. **Matches modern languages** — Rust/Zig detect compile-time, provide safe alternatives

### Real-World Example

```cnx
// Time-critical PID control loop (runs at 1kHz)
void pidUpdate() {
    u32 error <- setpoint - current;
    u32 derivative <- (error - lastError) / dt;  // Fast division, dt validated at init
    output <- Kp * error + Kd * derivative;
}

// Safety-critical speed calculation
void updateMotorSpeed() {
    u32 speed <- 100;  // Safe default (stopped)
    bool err <- safe_div(speed, distance, time, 100);
    if (err) {
        systemState <- State.FAULT;
        logError("Division by zero in motor speed");
    }
    motorControl(speed);  // Uses safe default if time=0
}
```

### ARM Cortex-M Safety

On ARM Cortex-M (most C-Next targets), division by zero **silently returns 0** without trapping. This means:

```c
uint32_t speed = distance / 0;  // speed = 0 (wrong, but no crash)
motorControl(speed);             // Motor receives bad command
```

With `safe_div()`:
```cnx
bool err <- safe_div(speed, distance, time, speed);  // Preserve current speed if time=0
```

This prevents silent corruption while allowing the developer to specify context-appropriate defaults.

---

## MISRA Compliance

**Rule 1.3:** "There shall be no occurrence of undefined or critical unspecified behavior"
- **Compile-time detection** catches statically determinable violations
- **safe_div()** provides runtime safety for critical paths
- Combined with ADR-012 static analysis (cppcheck/clang-tidy), achieves full coverage

**Directive 4.1:** "Run-time failures shall be minimized"
- Developers can use `safe_div()` for all division in safety-critical modules
- Error return value enables proper logging and fault handling

---

## Test Coverage Requirements

Add these test cases to validate the implementation:

### 1. Compile-Time Error Tests (Should Fail)

**File:** `tests/arithmetic/division-by-zero-literal.test.cnx`

```cnx
// Literal zero division
u32 result <- 10 / 0;
// Expected: Error: Division by zero
```

**File:** `tests/arithmetic/division-by-zero-const.test.cnx`

```cnx
// Const zero
const u32 ZERO <- 0;
u32 result <- 10 / ZERO;
// Expected: Error: Division by zero
```

**File:** `tests/arithmetic/modulo-by-zero-literal.test.cnx`

```cnx
// Modulo by zero
u32 remainder <- 10 % 0;
// Expected: Error: Division by zero
```

**File:** `tests/arithmetic/division-by-zero-const-expr.test.cnx`

```cnx
// Const expression evaluating to zero
const u32 VALUE <- 5 - 5;
u32 result <- 10 / VALUE;
// Expected: Error: Division by zero
```

### 2. Valid Division Tests (Should Pass)

**File:** `tests/arithmetic/division-runtime-variable.test.cnx`

```cnx
// Runtime variable (no compile-time check)
void testRuntimeDivision(u32 divisor) {
    u32 result <- 10 / divisor;  // Valid, no static check
}
```

**File:** `tests/arithmetic/division-non-zero-const.test.cnx`

```cnx
// Non-zero const
const u32 TEN <- 10;
u32 result <- 100 / TEN;  // Valid
```

### 3. safe_div() Built-in Tests

**File:** `tests/arithmetic/safe-div-basic.test.cnx`

```cnx
void testSafeDivBasic() {
    u32 result;

    // Division succeeds
    bool err1 <- safe_div(result, 100, 10, 0);
    // result should be 10, err1 should be false

    // Division by zero, uses default
    bool err2 <- safe_div(result, 100, 0, 999);
    // result should be 999, err2 should be true
}
```

**File:** `tests/arithmetic/safe-div-preserve-on-error.test.cnx`

```cnx
void testSafeDivPreserve() {
    u32 speed <- 100;

    // Preserve current value on error
    bool err <- safe_div(speed, 500, 0, speed);
    // speed should still be 100, err should be true
}
```

**File:** `tests/arithmetic/safe-mod-basic.test.cnx`

```cnx
void testSafeModBasic() {
    u32 result;

    // Modulo succeeds
    bool err1 <- safe_mod(result, 10, 3, 0);
    // result should be 1, err1 should be false

    // Modulo by zero, uses default
    bool err2 <- safe_mod(result, 10, 0, 99);
    // result should be 99, err2 should be true
}
```

**File:** `tests/arithmetic/safe-div-all-types.test.cnx`

```cnx
void testSafeDivAllTypes() {
    // Test all integer types
    u8 r8;
    u16 r16;
    u32 r32;
    u64 r64;
    i8 ri8;
    i16 ri16;
    i32 ri32;
    i64 ri64;

    bool e1 <- safe_div(r8, 100, 0, 0);
    bool e2 <- safe_div(r16, 1000, 0, 0);
    bool e3 <- safe_div(r32, 10000, 0, 0);
    bool e4 <- safe_div(r64, 100000, 0, 0);
    bool e5 <- safe_div(ri8, -100, 0, 0);
    bool e6 <- safe_div(ri16, -1000, 0, 0);
    bool e7 <- safe_div(ri32, -10000, 0, 0);
    bool e8 <- safe_div(ri64, -100000, 0, 0);
}
```

### 4. Floating-Point Division (IEEE 754 Behavior)

**File:** `tests/arithmetic/float-division-by-zero.test.cnx`

```cnx
void testFloatDivisionByZero() {
    // Floating-point division by zero is well-defined (IEEE 754)
    f32 result1 <- 10.0 / 0.0;   // +Inf
    f32 result2 <- -10.0 / 0.0;  // -Inf
    f32 result3 <- 0.0 / 0.0;    // NaN

    f64 result4 <- 10.0 / 0.0;   // +Inf
}
```

---

## Implementation Plan

### Phase 1: Compile-Time Detection

**Component:** Semantic Analyzer

1. Add constant expression evaluator to semantic analysis phase
2. During division/modulo operations, check if divisor is a compile-time constant
3. If constant evaluates to zero, emit error: `"Division by zero"`
4. Test with all error test cases

**Files to modify:**
- `src/analysis/SemanticAnalyzer.ts` (or equivalent)
- Add constant folding logic
- Emit error for zero divisors

### Phase 2: safe_div() and safe_mod() Built-ins

**Component:** Code Generator

1. Generate helper functions for all integer types:
   - `cnx_safe_div_u8`, `cnx_safe_div_u16`, `cnx_safe_div_u32`, `cnx_safe_div_u64`
   - `cnx_safe_div_i8`, `cnx_safe_div_i16`, `cnx_safe_div_i32`, `cnx_safe_div_i64`
   - `cnx_safe_mod_*` variants for modulo

2. Add to generated C header:
```c
// Division by zero safety helpers (ADR-051)
static inline bool cnx_safe_div_u32(uint32_t* output, uint32_t numerator,
                                     uint32_t divisor, uint32_t defaultIfZero) {
    if (divisor == 0) {
        *output = defaultIfZero;
        return true;  // Error occurred
    }
    *output = numerator / divisor;
    return false;  // Success
}

// ... repeat for all types
```

3. Recognize `safe_div()` and `safe_mod()` as built-in functions
4. Transpile calls to appropriate `cnx_safe_div_*` function based on output type
5. Test with all safe_div() test cases

**Files to modify:**
- `src/codegen/CodeGenerator.ts` (or equivalent)
- Add built-in function recognition
- Generate appropriate helper functions in C output

### Phase 3: Update Coverage Matrix

Add to `coverage.md`:

| Feature | Status | Test File |
|---------|--------|-----------|
| Division by zero error (literal) | [x] | `arithmetic/division-by-zero-literal.test.cnx` |
| Division by zero error (const) | [x] | `arithmetic/division-by-zero-const.test.cnx` |
| Modulo by zero error | [x] | `arithmetic/modulo-by-zero-literal.test.cnx` |
| safe_div() built-in | [x] | `arithmetic/safe-div-basic.test.cnx` |
| safe_mod() built-in | [x] | `arithmetic/safe-mod-basic.test.cnx` |

---

## Implementation Status

**Current:** Not implemented (transpiles division directly to C)

**Target:** v1.0 release

**Priority:** High (core safety feature)

---

## References

### Language Behavior Research

**Rust:**
- [Rust programs crash when dividing by zero](https://github.com/rust-lang/rust/issues/944)
- [Why dividing by zero has no safety guarantees](https://internals.rust-lang.org/t/question-why-does-dividing-by-zero-have-no-safety-guarantees/19189)
- [CheckedDiv trait](https://docs.rs/num/latest/num/trait.CheckedDiv.html)

**Zig:**
- [Add compile error for division by zero](https://github.com/ziglang/zig/issues/372)
- [Runtime Safety Guide](https://zig.guide/language-basics/runtime-safety/)
- [How (memory) safe is Zig?](https://www.scattered-thoughts.net/writing/how-safe-is-zig/)

**Ada:**
- [Understanding Built-in Exceptions in Ada](https://piembsystech.com/understanding-built-in-exceptions-in-ada-programming-language/)
- [SPARK for MISRA C Developers - Undefined Behavior](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html)

**Swift:**
- [Throwing Arithmetic Operators in Swift](https://medium.com/@wircho/throwing-arithmetic-operators-in-swift-6c39fca4ff0e)
- [Notes on numerics in Swift](https://numerics.diploid.ca/integers-part-2.html)

**Go:**
- [How does Go handle division by zero?](https://labex.io/questions/how-does-go-handle-division-by-zero-166173)

**C/C++:**
- [Undefined Behavior in C and C++](https://www.geeksforgeeks.org/cpp/undefined-behavior-c-cpp/)
- [UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)

### Embedded Systems & ARM

- [ARM Cortex-M division by zero behavior](https://medium.com/@pqshedy33/why-doesnt-the-program-crash-when-the-stm32-microcontroller-performs-zero-division-operation-fe53bb97a697)
- [Generic Hard Fault handler for ARM Cortex-M](https://blog.feabhas.com/2013/02/developing-a-generic-hard-fault-handler-for-arm-cortex-m3cortex-m4/)
- [ARM Cortex-M Exception Handling](https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic)

### MISRA C Standards

- [MISRA C:2012 Guidelines](https://wiki.sei.cmu.edu/confluence/display/c/MISRA+C:2012)
- [MISRA C 2012 Rules Explained](https://www.codeant.ai/blogs/misra-c-2012-rules-examples-pdf)
- [MISRA Compliance - Parasoft](https://www.parasoft.com/solutions/misra/)

### Related ADRs

- ADR-012: Static Analysis for Generated C Code
- ADR-044: Overflow Modifiers (clamp/wrap)
