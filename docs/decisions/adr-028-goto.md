# ADR-028: Goto Statement

## Status
**Research**

## Context

`goto` is controversial but has legitimate uses in C:
- Centralized cleanup (before RAII/defer)
- Breaking from deeply nested loops
- State machine implementations
- Error handling patterns

The Linux kernel uses goto extensively for cleanup.

## Decision Drivers

1. **Cleanup Pattern** - Common in C for resource cleanup
2. **Safety** - Easy to create spaghetti code
3. **Alternatives** - Could use `defer` instead (Zig/Go style)
4. **C Compatibility** - Sometimes needed for C interop

## Options Considered

### Option A: No Goto
Reject goto entirely. Use structured alternatives.

**Pros:** No spaghetti code possible
**Cons:** Some cleanup patterns become verbose

### Option B: Restricted Goto
Allow goto but only forward, within same function:
```cnx
void process() {
    if (error1) { goto cleanup; }
    if (error2) { goto cleanup; }

    cleanup:
    freeResources();
}
```

**Pros:** Enables cleanup pattern, limited danger
**Cons:** Still goto

### Option C: Add Defer Instead
```cnx
void process() {
    File f <- openFile("data.txt");
    defer closeFile(f);  // Runs at function exit

    if (error) { return; }

    // closeFile(f) called automatically
}
```

**Pros:** Modern, safer than goto
**Cons:** Different mental model

### Option D: Allow Full Goto
Same as C - developer responsibility.

**Pros:** Full C compatibility
**Cons:** All the C problems

## Recommended Decision

**Option A: No Goto for v1** - Focus on structured code.

Consider **Option C: Defer** for v2 as the cleanup solution.

## Rationale

C-Next philosophy is "safety through removal." Goto enables patterns that are better solved with:
- Early returns
- Flag variables
- Proper function decomposition
- (Eventually) defer statements

## Workarounds Without Goto

### Cleanup Pattern
```cnx
// Instead of goto cleanup:
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

// Or with early returns:
void process() {
    if (!step1()) { cleanup(); return; }
    if (!step2()) { cleanup(); return; }
    if (!step3()) { cleanup(); return; }
    cleanup();
}
```

### Breaking Nested Loops
```cnx
// Instead of goto found:
bool found <- false;
for (u32 i <- 0; i < 10 && !found; i +<- 1) {
    for (u32 j <- 0; j < 10 && !found; j +<- 1) {
        if (matrix[i][j] = target) {
            found <- true;
        }
    }
}
```

## Implementation Notes

### Priority
**Low** - Not implementing for v1.

### Future: Defer (v2)
If we add defer:
```antlr
deferStatement
    : 'defer' expression ';'
    ;
```

## Open Questions

1. Reconsider if user demand is high?
2. Defer for v2?

## References

- Linux kernel goto usage
- Go defer statement
- Zig defer and errdefer
- MISRA C goto rules (heavily restricted)
