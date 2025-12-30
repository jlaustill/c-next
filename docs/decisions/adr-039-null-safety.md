# ADR-039: Null Safety

## Status
**Research**

## Context

Null pointer dereference is a major bug source:
- Crashes
- Security vulnerabilities
- Hard to debug

Rust uses `Option<T>`, modern languages have null safety.

## Decision Drivers

1. **Safety** - Prevent null dereference bugs
2. **C Compatibility** - C uses null extensively
3. **Simplicity** - Don't overcomplicate
4. **Embedded Reality** - Sometimes null is valid

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

## Recommended Decision

**Option D: No Null Safety for v1**

Rationale:
- ADR-006 removes most pointer syntax
- ADR-015 zero-initializes everything
- Embedded often uses fixed structures, not dynamic allocation
- ADR-003 forbids dynamic allocation anyway

Consider Option C warnings for v2.

## Current State with ADR-015

With zero initialization, most null issues are avoided:
```cnx
struct Config {
    u32 baudRate;
    u8 mode;
}

Config cfg;  // Zero-initialized, not "null"

// Always safe to access
cfg.baudRate <- 115200;
```

## Where Null Still Matters

### Callback Pointers
```cnx
type Callback <- void(u32);
Callback handler <- null;  // No handler yet

void setHandler(Callback cb) {
    handler <- cb;
}

void fire(u32 event) {
    if (handler != null) {
        handler(event);
    }
}
```

### Optional Data
```cnx
// Could use sentinel values instead
const u32 NO_VALUE <- 0xFFFFFFFF;

u32 maybeData <- NO_VALUE;
if (maybeData != NO_VALUE) {
    process(maybeData);
}
```

## Future Consideration (v2)

If needed, add Optional type:
```cnx
Optional<Callback> handler <- None;

match (handler) {
    Some(cb): cb(event);
    None: { }
}
```

### Priority
**Low** - ADR-003, ADR-006, and ADR-015 address most concerns.

## Open Questions

1. Static analysis for null check patterns?
2. Optional type for v2?

## References

- Tony Hoare's "billion dollar mistake"
- Rust Option type
- ADR-003 Static Allocation
- ADR-006 Simplified References
- ADR-015 Null State
