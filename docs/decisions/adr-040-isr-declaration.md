# ADR-040: ISR Declaration

## Status
**Research**

## Context

Interrupt Service Routines (ISRs) are critical for embedded:
- Hardware interrupts (GPIO, timer, UART)
- Exception handlers (HardFault, NMI)
- System tick handlers

C uses platform-specific syntax and attributes.

## Decision Drivers

1. **Hardware Interrupts** - Essential for embedded
2. **Platform Variety** - Different MCUs, different syntax
3. **Safety** - ISRs have special constraints
4. **ADR-009** - Research on ISR safety already exists

## Options Considered

### Option A: Attribute-Based
```cnx
@isr(IRQ_TIMER0)
void timer0Handler() {
    clearInterrupt();
    count +<- 1;
}
```

### Option B: Keyword-Based
```cnx
isr timer0Handler for IRQ_TIMER0 {
    clearInterrupt();
    count +<- 1;
}
```

### Option C: Platform-Specific Pass-through
```cnx
void TIMER0_IRQHandler() __attribute__((interrupt)) {
    // ...
}
```

### Option D: Register in Vector Table
```cnx
type ISR <- void();

@section(".isr_vector")
const ISR vectorTable[] <- {
    resetHandler,
    nmiHandler,
    hardFaultHandler,
    timer0Handler,
    // ...
};

void timer0Handler() {
    // Normal function, registered in vector
}
```

## Recommended Decision

**Option D: Vector Table Registration** for v1 - Keep ISRs as normal functions.

Platform-specific vector table setup is explicit.

## Syntax

### ISR as Normal Function
```cnx
void SysTick_Handler() {
    tickCount +<- 1;
}

void UART0_IRQHandler() {
    u8 data <- readRegister();
    buffer[idx] <- data;
    idx +<- 1;
}
```

### Vector Table (Cortex-M example)
```cnx
type ISRHandler <- void();

// Vector table in flash
@section(".isr_vector")
const ISRHandler vectors[] <- {
    null,              // Initial SP (set by linker)
    Reset_Handler,     // Reset
    NMI_Handler,       // NMI
    HardFault_Handler, // Hard Fault
    // ... more handlers
    SysTick_Handler,   // SysTick
    // ... peripheral interrupts
    UART0_IRQHandler,
};
```

### ISR Constraints (enforced by ADR-009 research)
- No blocking calls
- Minimal execution time
- Volatile access for shared data
- No dynamic allocation

## Implementation Notes

### Priority
**Medium** - Function pointers (ADR-029) needed first.

### Ties to ADR-009
ADR-009 researches ISR safety patterns. This ADR focuses on syntax.

### Platform Specifics
Generated C will use platform conventions:
```c
// Cortex-M: weak default handlers
void __attribute__((weak)) SysTick_Handler(void) { }

// AVR: ISR macro
ISR(TIMER0_OVF_vect) { }
```

## Open Questions

1. Abstract over platform differences?
2. ISR priority/preemption attributes?
3. Critical section macros?

## References

- Cortex-M vector table
- AVR interrupt handling
- ADR-009 ISR Safety
