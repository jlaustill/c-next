# ADR-042: Error Handling

## Status
**Rejected**

## Decision

**No dedicated error handling syntax needed.** Error handling patterns work naturally with existing C-Next features.

## Rationale

C-Next's existing features provide all necessary error handling capabilities:

| Pattern | How It Works in C-Next |
|---------|------------------------|
| Return codes | Use enums (ADR-017) as return types |
| Out parameters | Pass-by-reference (ADR-006) allows modifying caller's variables |
| Rich results | Return structs containing both value and status |

### Example Patterns (All Work Today)

**Pattern 1: Return code + out parameter**
```cnx
Status readSensor(u32 value) {
    if (timeout) { return Status.TIMEOUT; }
    value <- sensorValue;  // Modified via pass-by-reference
    return Status.OK;
}
```

**Pattern 2: Struct return**
```cnx
struct SensorResult {
    u32 value;
    Status status;
}

SensorResult readSensor() {
    SensorResult result;
    result.value <- sensorValue;
    result.status <- Status.OK;
    return result;
}
```

Adding Result<T, E> types or special syntax would add complexity without meaningful improvement over these patterns.

## Original Context

Error handling in embedded C:
- Return codes (0 = success, non-zero = error)
- Global errno
- Exceptions (not in embedded)
- Panic/assert for unrecoverable errors

Modern languages use Result types (Rust) or multiple returns (Go).

## Options Considered

### Option A: C-Style Return Codes
```cnx
enum Error { OK, TIMEOUT, INVALID_PARAM }

Error doSomething() {
    if (badInput) { return Error.INVALID_PARAM; }
    return Error.OK;
}

Error result <- doSomething();
if (result != Error.OK) { handleError(result); }
```

**Pros:** Familiar, simple
**Cons:** Easy to ignore errors

### Option B: Result Type (Rust-style)
```cnx
Result<u32, Error> readSensor() {
    if (timeout) { return Err(Error.TIMEOUT); }
    return Ok(value);
}

match (readSensor()) {
    Ok(v): process(v);
    Err(e): handleError(e);
}
```

**Pros:** Forces error handling
**Cons:** Complex, unfamiliar

### Option C: Multiple Returns (Go-style)
```cnx
(u32, Error) readSensor() {
    if (timeout) { return (0, Error.TIMEOUT); }
    return (value, Error.OK);
}

(value, err) <- readSensor();
if (err != Error.OK) { handleError(err); }
```

**Pros:** Explicit, clear
**Cons:** Syntax overhead

### Option D: Out Parameters
```cnx
bool readSensor(u32 value) {
    if (timeout) { return false; }
    value <- sensorValue;
    return true;
}

u32 value;
if (!readSensor(value)) { handleError(); }
```

**Pros:** C-style, explicit
**Cons:** Awkward for complex errors

## Why All Options Were Rejected

1. **Option A** (return codes) already works with enums (ADR-017) — no new feature needed
2. **Option B** (Result types) adds complexity; struct returns achieve the same goal
3. **Option C** (multiple returns) adds syntax for something structs already handle
4. **Option D** (out parameters) already works naturally with pass-by-reference (ADR-006)

The original "recommended decision" was Option A, which is just "use existing features" — confirming no new language feature is required.

## References

- C error handling patterns
- Rust Result type
- Go error handling
- ADR-006 Simplified References (pass-by-reference)
- ADR-017 Enums
