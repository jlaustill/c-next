# ADR-040: ISR Declaration

## Status

**Implemented**

## Context

Interrupt Service Routines (ISRs) are critical for embedded:

- Hardware interrupts (GPIO, timer, UART)
- Exception handlers (HardFault, NMI)
- System tick handlers

C uses platform-specific syntax and attributes. C-Next needs a simple, portable way to declare and pass ISRs.

## Decision Drivers

1. **Simplicity** - ISRs are just `void(void)` functions
2. **Type Safety** - Ensure only valid ISRs are passed where expected
3. **No New Syntax** - Leverage existing function declaration
4. **Platform Agnostic** - Vector table setup is platform-specific (linker/startup)

## Decision

**Built-in `ISR` type** - A primitive type representing `void(void)` function pointers.

### Key Points

1. ISRs are defined as regular `void()` functions
2. `ISR` is a built-in type (like `u8`, `i32`) for `void(void)` function pointers
3. Any `void()` function is compatible with `ISR` (structural typing)
4. Vector table setup is handled by platform startup code, not C-Next syntax

## Syntax

### Defining an ISR

```cnx
// ISRs are just regular void() functions
void timerHandler() {
    clearInterrupt();
    count +<- 1;
}

void uartHandler() {
    u8 data <- readRegister();
    buffer[idx] <- data;
    idx +<- 1;
}
```

### Using the ISR Type

```cnx
// Accept any void() function as an ISR
void registerHandler(ISR handler) {
    _handler <- handler;
}

// Store ISRs
struct InterruptController {
    ISR timerCallback;
    ISR uartCallback;
}

// Pass any void() function
registerHandler(timerHandler);  // OK
registerHandler(uartHandler);   // OK
```

### ISR Arrays (Vector Tables)

```cnx
// Array of ISRs
ISR[4] handlers;

// Initialize
handlers[0] <- timerHandler;
handlers[1] <- uartHandler;
```

## Transpilation

```cnx
void timerHandler() {
    count +<- 1;
}

void registerHandler(ISR handler) {
    _handler <- handler;
}

registerHandler(timerHandler);
```

Generates:

```c
typedef void (*ISR)(void);

void timerHandler(void) {
    count += 1;
}

void registerHandler(ISR handler) {
    _handler = handler;
}

registerHandler(timerHandler);
```

## Comparison with ADR-029 Callbacks

| Feature     | ADR-029 Callbacks               | ISR Type                     |
| ----------- | ------------------------------- | ---------------------------- |
| Typing      | Nominal (function name is type) | Structural (signature match) |
| Null safety | Never null (has default)        | Can be null                  |
| Use case    | Event handlers, plugins         | Interrupt vectors            |
| Signature   | Any signature                   | Always `void(void)`          |

## Platform Notes

Vector table placement is handled by:

- Linker scripts (`.isr_vector` section)
- Platform startup code (weak handlers)
- Vendor HALs

C-Next does not provide `@section` attributes in v1. The `ISR` type enables passing handlers to platform setup code.

## ISR Constraints

ISRs have special runtime constraints (see ADR-009 for safety research):

- No blocking calls
- Minimal execution time
- Volatile access for shared data
- No dynamic allocation

These are not enforced by the type system but are documented best practices.

## Implementation Notes

### Priority

**Low** - Simple addition of a built-in typedef.

### Implementation

1. Add `ISR` to the list of primitive types
2. Generate `typedef void (*ISR)(void);` in C output
3. Allow any `void()` function to be assigned to `ISR`

## References

- ADR-009: ISR Safety (shared state patterns)
- ADR-029: Callbacks (nominal typing for event handlers)
- Cortex-M vector table conventions
- AVR interrupt handling
