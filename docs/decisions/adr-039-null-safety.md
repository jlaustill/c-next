# ADR-039: Null Safety

## Status
**Rejected**

## Decision

**No dedicated null safety feature needed.** Null safety is an emergent property of C-Next's foundational design decisions.

## Rationale

Null pointer bugs in C arise from specific sources. C-Next's existing ADRs eliminate all of them:

| Null Source in C | C-Next Prevention | ADR |
|------------------|-------------------|-----|
| `malloc()` returns NULL | No dynamic allocation | ADR-003 |
| Uninitialized pointer | Zero-init globals, error for locals | ADR-015 |
| Dangling pointer after `free()` | No `free()` exists | ADR-003 |
| Pointer arithmetic gone wrong | No pointer arithmetic | ADR-006 |
| Pointer reassignment to invalid address | Addresses cannot be reassigned | ADR-006 |

The only remaining case is **intentionally unset callbacks**, which:
1. Are zero-initialized (predictably null, not garbage)
2. Require standard null checks before invocation (universal embedded practice)
3. Are too narrow a use case to justify language complexity

Adding Option types or nullable annotations would add complexity without meaningful safety improvement over what ADR-003 + ADR-006 + ADR-015 already provide.

## Original Context

Null pointer dereference is a major bug source:
- Crashes
- Security vulnerabilities
- Hard to debug

Rust uses `Option<T>`, modern languages have null safety.

## Options Considered

### Option A: Optional Types (Rust-style)
```cnx
Option<u32> maybeValue <- Some(42);
Option<u32> empty <- None;

// Must unwrap
if (maybeValue.isSome()) {
    u32 val <- maybeValue.unwrap();
}
```

**Pros:** Maximum safety
**Cons:** Complex, changes mental model

### Option B: Nullable Annotation
```cnx
u32? maybeValue <- 42;
u32? empty <- null;

if (maybeValue != null) {
    u32 val <- maybeValue;  // Safe after check
}
```

**Pros:** Cleaner syntax, explicit
**Cons:** Still need runtime checks

### Option C: Warnings Only
No language change, but warn on:
- Dereference without null check
- Uninitialized pointer use

**Pros:** No syntax change
**Cons:** Can ignore warnings

### Option D: No Null Safety
Trust the developer. Focus on ADR-015 zero initialization.

**Pros:** Simple
**Cons:** No safety improvement

## Why All Options Were Rejected

1. **Options A & B** (Option types, nullable annotations) add syntax complexity for a problem that doesn't exist in C-Next's memory model
2. **Option C** (warnings) is redundant — ADR-015 already enforces init-before-use for locals
3. **Option D** (do nothing) was the original recommendation, which led to this rejection

## Callback Pattern (The One Remaining Case)

For function pointers that may be unset:

```cnx
type Callback <- void(u32);
Callback handler;  // Zero-initialized (null)

void fire(u32 event) {
    if (handler != null) {
        handler(event);
    }
}
```

This is standard embedded practice and doesn't require language-level null safety.

## References

- Tony Hoare's "billion dollar mistake"
- Rust Option type
- ADR-003 Static Allocation
- ADR-006 Simplified References
- ADR-015 Null State
