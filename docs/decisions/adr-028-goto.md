# ADR-028: Goto Statement

## Status
**Rejected**

## Decision

**Cnx will NEVER have `goto`. Ever. This is final and non-negotiable.**

## Context

`goto` is controversial but has uses in C:
- Centralized cleanup patterns
- Breaking from deeply nested loops
- State machine implementations
- Error handling patterns

The Linux kernel uses goto extensively for cleanup.

## Why We Reject Goto Permanently

### 1. Spaghetti Code
`goto` enables arbitrary control flow that makes code impossible to reason about. You cannot look at a block of code and understand when it executes without scanning the entire function for labels.

### 2. Better Alternatives Exist
Every legitimate use case for `goto` has a structured alternative:

| Use Case | Structured Alternative |
|----------|----------------------|
| Centralized cleanup | Call cleanup function before each return |
| Breaking nested loops | Use a flag variable in loop conditions |
| State machines | Use enum + switch (see ADR-029) |
| Error handling | Early returns with explicit cleanup |

### 3. MISRA C Heavily Restricts Goto
Even in safety-critical C code, MISRA rules severely limit `goto`:
- Only forward jumps allowed
- Only to a label in the same block or enclosing block
- Heavy documentation requirements

If `goto` is too dangerous for safety-critical C, Cnx should not have it at all.

### 4. Cnx Philosophy: Safety Through Removal
Cnx makes code safe by removing dangerous features, not by adding guardrails around them. We don't restrict `goto` - we eliminate it entirely.

## Workarounds Without Goto

### Cleanup Pattern
```cnx
// Use explicit cleanup calls
void process() {
    if (!step1()) { cleanup(); return; }
    if (!step2()) { cleanup(); return; }
    if (!step3()) { cleanup(); return; }
    cleanup();
}

// Or use a success flag
void process() {
    bool success <- false;

    if (step1()) {
        if (step2()) {
            if (step3()) {
                success <- true;
            }
        }
    }

    cleanup();
    return success;
}
```

### Breaking Nested Loops
```cnx
// Use flag in loop conditions
bool found <- false;
for (u32 i <- 0; i < 10 && !found; i +<- 1) {
    for (u32 j <- 0; j < 10 && !found; j +<- 1) {
        if (matrix[i][j] == target) {
            found <- true;
        }
    }
}

// Or extract to a function with early return
bool findInMatrix(Matrix m, i32 target, u32 outI, u32 outJ) {
    for (u32 i <- 0; i < 10; i +<- 1) {
        for (u32 j <- 0; j < 10; j +<- 1) {
            if (m[i][j] == target) {
                outI <- i;
                outJ <- j;
                return true;
            }
        }
    }
    return false;
}
```

### State Machines
See ADR-029: Use enum + switch pattern, not function pointer dispatch with goto.

## What About Future Versions?

**No.** This decision is permanent.

If you find yourself wanting `goto` in Cnx, restructure your code. The momentary inconvenience of refactoring is better than the long-term maintenance nightmare that `goto` enables.

## References

- MISRA C:2012 Rule 15.1-15.3 (goto restrictions)
- Dijkstra's "Go To Statement Considered Harmful" (1968)
- Linux kernel goto usage (not a pattern Cnx will follow)
