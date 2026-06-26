# ADR-112: All-Paths-Return Diagnostic

**Status:** Accepted
**Date:** 2026-06-25
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-022 (Conditional Expressions), ADR-025 (Switch Statements), ADR-026 (Break and Continue), ADR-027 (Do-While)

## Context

C-Next currently accepts a function declared with a **non-void return type** that never executes a `return` statement, and silently emits C that falls off the end of the function (Issue #1040):

```cnx
scope Demo {
    u8 getValue() {
        u8 someByte <- 123;
        u8 nextByte <- someByte;
    }   // <- no return; falls off the end
}
```

```c
uint8_t Demo_getValue(void) {
    uint8_t someByte = 123U;
    uint8_t nextByte = someByte;
}   // using this return value is undefined behavior in C
```

Reaching the end of a value-returning function and then using the result is **undefined behavior** in C. `cppcheck` catches it downstream (`missingReturn`), but a "safer C" should reject it at the source. This gap has held `npm run analyze` red since 2026-01-03 (`examples/teensy4/blink.cnx`, `u8 doSomething()`).

There is no control-flow-reachability analysis in the transpiler today.

## Decision

Add a compile-time diagnostic, **error E0704**, emitted when a function with a non-void return type has a control-flow path that can reach the end of its body without returning a value.

The analysis is intentionally **strict and conservative** (sound): it never accepts a function that might fall through, and it does not attempt to prove that loops are infinite or that a `switch` over an enum is exhaustive. Where it cannot prove a return, it requires an explicit one.

### The rule

A non-void function is rejected unless `definitelyReturns(body)` is true, computed structurally:

| Construct                                   | `definitelyReturns`                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `return <expression>;`                      | **true**                                                                                                            |
| `return;` (no value) in a non-void function | **false** — and reported, since it returns no value                                                                 |
| block / statement list                      | true iff **any** contained statement `definitelyReturns` (statements after an unconditional return are unreachable) |
| `if`/`else`                                 | true iff an `else` is present **and** both branches `definitelyReturns`                                             |
| `if` without `else`                         | **false**                                                                                                           |
| `switch`                                    | true iff a `default` is present **and** every case block **and** the default `definitelyReturns`                    |
| `while` / `for`                             | **false** (the body may not execute)                                                                                |
| `do-while`                                  | `definitelyReturns(body)` (the body always executes once)                                                           |
| any other statement                         | **false**                                                                                                           |

Because C-Next has no `break`/`continue` (ADR-026), loop bodies have no early structural exits to reason about, which keeps the analysis simple.

### Consequences (intended strictness)

- An `if` without `else`, a `switch` without `default`, and a `while`/`for` loop never count as a guaranteed return; the author adds an explicit trailing `return`.
- A `do-while` counts as returning exactly when its body unconditionally returns (sound — the body always runs once).

### Known limitation

A non-void function whose body is an infinite loop with no return (e.g. `while (1 = 1) { ... }`) is conservatively flagged, because the analyzer does not prove loop infiniteness. This is rare for value-returning functions (infinite loops are normally `void`). Recognizing constant-true loop conditions as non-terminating is a possible future enhancement; it is deliberately out of scope here to keep v1 strict and simple.

## Examples

```cnx
// ERROR E0704: falls off the end
u8 missing() {
    u8 x <- 1;
}

// ERROR E0704: `if` without `else` is not a guaranteed return
u8 ifOnly(bool ready) {
    if (ready = true) { return 1; }
}

// ERROR E0704: switch without default
u8 noDefault(EColor c) {
    switch (c) {
        case EColor.RED { return 1; }
        case EColor.BLUE { return 2; }
    }
}

// OK: both branches return
u8 ifElse(bool ready) {
    if (ready = true) { return 1; } else { return 0; }
}

// OK: switch with default, all paths return
u8 withDefault(EColor c) {
    switch (c) {
        case EColor.RED { return 1; }
        default { return 0; }
    }
}

// OK: do-while body always returns
u8 doReturns() {
    do { return 7; } while (1 = 1);
}
```

## Implementation

- New `ReturnPathAnalyzer` (a `CNextListener`) in `src/transpiler/logic/analysis/`, registered in `runAnalyzers.ts`, following the existing analyzer pattern.
- Function return types are read from the resolved symbol information already available to analyzers.
- Error code **E0704** joins the control-flow family (E0701 boolean condition, E0702 function call in condition, E0703 break/continue).

## Testing

- `test-error` reproductions under `tests/bugs/issue-1040-all-paths-return/` covering: no return at all, `if` without `else`, one `if/else` branch missing a return, `switch` without `default`, `while`-only body, and bare `return;` in a non-void function.
- Positive (must-still-compile) tests for: `if/else` both returning, `switch` with `default`, `do-while` returning, and nested combinations.

## Migration

This is a behavior change: code that currently compiles becomes an error. Existing `tests/**` functions that the diagnostic newly flags are genuinely missing returns and will be corrected. `examples/teensy4/blink.cnx` (`u8 doSomething()`) is fixed as part of this work, which returns `npm run analyze` to green.
