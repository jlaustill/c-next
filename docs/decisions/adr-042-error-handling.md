# ADR-042: Error Handling

## Status
**Research**

## Context

Error handling in embedded C:
- Return codes (0 = success, non-zero = error)
- Global errno
- Exceptions (not in embedded)
- Panic/assert for unrecoverable errors

Modern languages use Result types (Rust) or multiple returns (Go).

## Decision Drivers

1. **Embedded Reality** - No exceptions, minimal overhead
2. **C Compatibility** - Work with existing C patterns
3. **Simplicity** - Don't overcomplicate
4. **Reliability** - Handle errors explicitly

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

## Recommended Decision

**Option A: C-Style Return Codes** for v1.

Use enums (ADR-017) for error codes. Keep it simple.

## Syntax

### Error Enum
```cnx
enum Status {
    OK <- 0,
    ERROR_TIMEOUT,
    ERROR_INVALID,
    ERROR_BUSY,
    ERROR_OVERFLOW
}
```

### Function Returns Error
```cnx
Status initUART(u32 baudRate) {
    if (baudRate = 0) {
        return Status.ERROR_INVALID;
    }
    // ... init code
    return Status.OK;
}
```

### Check and Handle
```cnx
Status result <- initUART(115200);
if (result != Status.OK) {
    logError(result);
    return result;  // Propagate
}
```

### Assert for Unrecoverable
```cnx
void assert(bool condition) {
    if (!condition) {
        // Platform-specific: halt, reset, log
        while (true) { }
    }
}

void process(u8 buffer[]) {
    assert(buffer != null);
    // ...
}
```

## Future Consideration (v2)

If demand exists, add Result type:
```cnx
Result<u32, Status> readSensor() {
    // ...
}
```

With pattern matching (depends on ADR-025 switch evolution).

### Priority
**Low** - C-style return codes work. Enums (ADR-017) are prerequisite.

## Open Questions

1. Built-in assert macro/function?
2. Panic handler for hard errors?
3. Result type for v2?

## References

- C error handling patterns
- Rust Result type
- Go error handling
- MISRA C error handling
