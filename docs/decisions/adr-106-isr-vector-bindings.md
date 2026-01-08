# ADR-106: ISR Vector Table Bindings

**Status:** Research
**Date:** 2026-01-07
**Decision Makers:** C-Next Language Design Team
**Parent ADR:** [ADR-009: ISR Safety](adr-009-isr-safety.md)

## Context

When an interrupt fires on ARM Cortex-M, the CPU reads a function pointer from the **vector table** - a memory-mapped array of addresses. The key insight is that **the vector table is just another hardware register** with chip-specific addresses defined in the datasheet.

C-Next's register binding system (ADR-004) is designed exactly for this: platform-specific memory-mapped definitions. This ADR explores treating ISR vector tables as register bindings.

### The Hardware Mechanism

```
1. Hardware event (UART byte received)
         ↓
2. Peripheral sets interrupt pending flag in NVIC
         ↓
3. CPU looks up IRQ number (e.g., 20 for LPUART1 on IMXRT1062)
         ↓
4. CPU reads address from: VECTOR_TABLE_BASE + (IRQ + 16) × 4
         ↓
5. CPU jumps to that address (your ISR)
```

The "+16" accounts for the 16 ARM exception vectors (Reset, NMI, HardFault, etc.) that precede the vendor-specific IRQs.

### Platform Variation

Each chip family has different IRQ assignments:

| Peripheral | STM32F446 IRQ | IMXRT1062 (Teensy 4) IRQ |
| ---------- | ------------- | ------------------------ |
| UART1      | 37            | 20 (LPUART1)             |
| CAN1       | 20            | 36                       |
| SPI1       | 35            | 32 (LPSPI1)              |
| Timer      | 28 (TIM2)     | Various (GPT, PIT, etc.) |

This is why **register definitions are never portable MCU to MCU** - each platform needs its own definitions.

---

## Proposed Design

### Register Binding for Vector Table

Treat the vector table as a register with ISR-typed fields:

```cnx
// Platform: Teensy 4.1 (IMXRT1062)
// Vector table is in RAM at 0x20000000 (copied at startup)
#ifdef TEENSY41

register VectorTable @ 0x20000000 {
    // ARM Exceptions (0-15)
    StackPointer:     u32  ro @ 0x00,
    Reset:            ISR  ro @ 0x04,
    NMI:              ISR  rw @ 0x08,
    HardFault:        ISR  rw @ 0x0C,
    MemManage:        ISR  rw @ 0x10,
    BusFault:         ISR  rw @ 0x14,
    UsageFault:       ISR  rw @ 0x18,
    // Reserved 0x1C - 0x2B
    SVCall:           ISR  rw @ 0x2C,
    DebugMonitor:     ISR  rw @ 0x30,
    // Reserved 0x34
    PendSV:           ISR  rw @ 0x38,
    SysTick:          ISR  rw @ 0x3C,

    // Vendor IRQs (16+) - IMXRT1062 specific
    // Offset = (16 + IRQ_NUMBER) × 4
    DMA_CH0:          ISR  rw @ 0x40,   // IRQ 0
    DMA_CH1:          ISR  rw @ 0x44,   // IRQ 1
    // ... DMA channels 2-15 ...
    DMA_ERROR:        ISR  rw @ 0x80,   // IRQ 16
    LPUART1:          ISR  rw @ 0x90,   // IRQ 20
    LPUART2:          ISR  rw @ 0x94,   // IRQ 21
    LPUART3:          ISR  rw @ 0x98,   // IRQ 22
    LPUART4:          ISR  rw @ 0x9C,   // IRQ 23
    LPUART5:          ISR  rw @ 0xA0,   // IRQ 24
    LPUART6:          ISR  rw @ 0xA4,   // IRQ 25
    LPUART7:          ISR  rw @ 0xA8,   // IRQ 26
    LPUART8:          ISR  rw @ 0xAC,   // IRQ 27
    LPI2C1:           ISR  rw @ 0xB0,   // IRQ 28
    LPI2C2:           ISR  rw @ 0xB4,   // IRQ 29
    LPI2C3:           ISR  rw @ 0xB8,   // IRQ 30
    LPI2C4:           ISR  rw @ 0xBC,   // IRQ 31
    LPSPI1:           ISR  rw @ 0xC0,   // IRQ 32
    LPSPI2:           ISR  rw @ 0xC4,   // IRQ 33
    LPSPI3:           ISR  rw @ 0xC8,   // IRQ 34
    LPSPI4:           ISR  rw @ 0xCC,   // IRQ 35
    CAN1:             ISR  rw @ 0xD0,   // IRQ 36
    CAN2:             ISR  rw @ 0xD4,   // IRQ 37
    // ... continues to IRQ 159 ...
    GPIO6789:         ISR  rw @ 0x2B4,  // IRQ 157 (high-speed GPIO)
}

// NVIC Interrupt Set-Enable Registers
register NVIC @ 0xE000E100 {
    ISER0:            u32  rw @ 0x00,   // Enable IRQs 0-31
    ISER1:            u32  rw @ 0x04,   // Enable IRQs 32-63
    ISER2:            u32  rw @ 0x08,   // Enable IRQs 64-95
    ISER3:            u32  rw @ 0x0C,   // Enable IRQs 96-127
    ISER4:            u32  rw @ 0x10,   // Enable IRQs 128-159
}

#endif // TEENSY41
```

### User Code

```cnx
#include "teensy41.cnx"  // Platform-specific registers

void myUartHandler() {
    // Handle LPUART1 interrupt
    u8 data <- LPUART1.DATA;
    // ...
}

void setup() {
    // Assign ISR to vector table
    VectorTable.LPUART1 <- myUartHandler;

    // Enable IRQ 20 in NVIC (bit 20 in ISER0)
    NVIC.ISER0 <- (1 << 20);
}
```

### Generated C Code

```c
void myUartHandler(void) {
    uint8_t data = LPUART1_DATA;
    // ...
}

void setup(void) {
    // Vector table write (RAM-based on Teensy)
    ((void(**)(void))0x20000000)[16 + 20] = myUartHandler;

    // NVIC enable
    (*(volatile uint32_t*)0xE000E100) = (1 << 20);
}
```

---

## Platform Considerations

### Flash vs RAM Vector Tables

| Platform          | Vector Table     | Writable at Runtime? | C-Next Strategy               |
| ----------------- | ---------------- | -------------------- | ----------------------------- |
| Teensy 4.x        | RAM (0x20000000) | Yes                  | Direct write via register     |
| STM32 (default)   | Flash            | No                   | Link-time binding (see below) |
| STM32 (relocated) | RAM              | Yes                  | Direct write via register     |
| Cortex-M0         | Flash only       | No                   | Link-time binding only        |

### Link-Time Binding for Flash Tables

For platforms where the vector table is in Flash, C-Next could support a `link` access modifier:

```cnx
// STM32F4 - vector table in Flash
register VectorTable @ 0x08000000 {
    USART1:           ISR  link @ 0xD4,   // IRQ 37
}

// This assignment:
VectorTable.USART1 <- myHandler;

// Generates a function with the CMSIS handler name:
void USART1_IRQHandler(void) {
    myHandler();  // Or inlines the body
}
// Linker places it in vector table via weak symbol override
```

The `link` modifier indicates "resolved at link time, not runtime."

---

## Open Questions

### Q1: Platform Definition Files

How should platform-specific register definitions be distributed?

**Options:**

- A) Built into C-Next compiler (requires updates for new chips)
- B) External `.cnx` header files (community-maintained)
- C) Generated from vendor SVD/CMSIS-SVD files (automated)

### Q2: IRQ Number Calculation

Should C-Next support computed offsets?

```cnx
// Option A: Explicit offset for each IRQ
LPUART1:          ISR  rw @ 0x90,   // (16+20)*4 = 0x90

// Option B: Computed from IRQ number
LPUART1:          ISR  rw @ irq(20),   // Compiler computes (16+20)*4
```

### Q3: NVIC Enable Integration

Should assigning an ISR automatically enable the IRQ?

```cnx
// Option A: Explicit (current)
VectorTable.LPUART1 <- myHandler;
NVIC.ISER0 <- (1 << 20);

// Option B: Automatic
VectorTable.LPUART1 <- myHandler;  // Also enables IRQ

// Option C: Combined syntax
VectorTable.LPUART1.enable <- myHandler;
```

### Q4: Priority Configuration

How should interrupt priorities be set?

```cnx
// NVIC Interrupt Priority Registers
register NVIC_IPR @ 0xE000E400 {
    IPR0:   u32 rw @ 0x00,   // Priorities for IRQs 0-3
    IPR1:   u32 rw @ 0x04,   // Priorities for IRQs 4-7
    // ...
}

// Possible syntax?
VectorTable.LPUART1.priority <- 64;  // Lower = higher priority
```

### Q5: Link-Time vs Runtime Detection

Can C-Next detect whether the vector table is writable and choose the appropriate strategy automatically?

---

## Teensy 4.1 IRQ Reference

From [imxrt.h](https://github.com/PaulStoffregen/cores/blob/master/teensy4/imxrt.h):

| IRQ   | Name       | Offset      | Description       |
| ----- | ---------- | ----------- | ----------------- |
| 0-15  | DMA_CH0-15 | 0x40-0x7C   | DMA channels      |
| 16    | DMA_ERROR  | 0x80        | DMA error         |
| 20-27 | LPUART1-8  | 0x90-0xAC   | Low-power UART    |
| 28-31 | LPI2C1-4   | 0xB0-0xBC   | Low-power I2C     |
| 32-35 | LPSPI1-4   | 0xC0-0xCC   | Low-power SPI     |
| 36-37 | CAN1-2     | 0xD0-0xD4   | FlexCAN           |
| 80-89 | GPIO1-5    | 0x180-0x1A4 | Slow GPIO (split) |
| 157   | GPIO6789   | 0x2B4       | High-speed GPIO   |

Full list: 160 IRQs (0-159)

---

## Related ADRs

- **ADR-004**: Register Bindings (foundation for this approach)
- **ADR-009**: ISR Safety (parent ADR)
- **ADR-040**: ISR Type (defines `ISR` type for function pointers)
- **ADR-049**: Atomic Types (target configuration mechanism)

---

## References

- [ARM Cortex-M Vector Table](https://developer.arm.com/documentation/107565/latest/Use-case-examples/Generic-Information/What-is-inside-a-program-image-/Vector-table)
- [ARM Cortex-M Startup Code](https://allthingsembedded.com/post/2019-01-03-arm-cortex-m-startup-code-for-c-and-c/)
- [Teensyduino startup.c](https://github.com/PaulStoffregen/cores/blob/master/teensy4/startup.c)
- [IMXRT1062 imxrt.h IRQ definitions](https://github.com/PaulStoffregen/cores/blob/master/teensy4/imxrt.h)
- [PJRC attachInterruptVector](https://forum.pjrc.com/index.php?threads/attachinterruptvector-with-teensy-4-0.58544/)
- [IMXRT1060 Reference Manual](https://www.pjrc.com/teensy/IMXRT1060RM_rev3.pdf) (IRQ table starts page 44)
