# Platform Comparison: Teensy 4.x vs Nucleo-F446RE

This document compares the initialization and hardware differences between the Teensy 4.x (i.MX RT1062) and Nucleo-F446RE (STM32F446) platforms for C-Next development.

## Hardware Overview

| Feature           | Teensy 4.1              | Nucleo-F446RE            |
| ----------------- | ----------------------- | ------------------------ |
| **MCU**           | NXP i.MX RT1062         | STM32F446RE              |
| **Core**          | ARM Cortex-M7 @ 600 MHz | ARM Cortex-M4F @ 180 MHz |
| **Flash**         | 8 MB (QSPI)             | 512 KB (internal)        |
| **RAM**           | 1024 KB                 | 128 KB                   |
| **GPIO Banks**    | GPIO1-GPIO9             | GPIOA-GPIOH              |
| **Built-in LED**  | GPIO7, Bit 3 (Pin 13)   | GPIOA, Pin 5 (LD2)       |
| **Default Clock** | 600 MHz (ready to use)  | 16 MHz HSI (low power)   |

## Initialization Comparison

### 1. Clock Gating

**Teensy 4.x (i.MX RT1062):**

- ✅ All GPIO clocks enabled by default
- ✅ No explicit clock configuration needed for basic GPIO
- ✅ Runs at full speed out of reset

```cnx
// Teensy: No clock enable needed
// Just configure and use GPIO directly
```

**Nucleo-F446RE (STM32F446):**

- ⚠️ All peripheral clocks DISABLED by default (power saving)
- ⚠️ Must explicitly enable GPIO clock before use
- ⚠️ Boots at 16 MHz (needs PLL config for 180 MHz)

```cnx
// STM32: MUST enable clock first
RCC.RCC.AHB1ENR.GPIOAEN <- true;  // Enable GPIOA clock

// Then configure GPIO...
```

### 2. GPIO Configuration

**Teensy 4.x:**

- Simple: 1-bit direction register (GDIR)
- Output type is always push-pull
- Speed is fixed/automatic
- 3 registers total: DIR, DR, BSRR-equivalents

```cnx
// Teensy GPIO Configuration (via Arduino)
pinMode(LED_PIN, OUTPUT);  // Sets direction bit

// Or bare metal:
GPIO7.DirectionRegister.LED_BUILTIN <- true;
```

**Nucleo-F446RE:**

- Complex: Multiple 2-bit fields per pin
- Must configure: Mode, Output Type, Speed, Pull-up/down
- 5+ registers for full configuration

```cnx
// STM32 GPIO Configuration (bare metal)
// 1. Mode: 2 bits per pin (INPUT, OUTPUT, ALTERNATE, ANALOG)
STM32F446.GPIOA.ModeRegister[10, 2] <- (u8)STM32F446.GPIOMode.OUTPUT;

// 2. Output Type: Push-pull or Open-drain
STM32F446.GPIOA.OutputTypeRegister.LD2 <- (bool)STM32F446.GPIOOutputType.PUSH_PULL;

// 3. Speed: LOW, MEDIUM, HIGH, VERY_HIGH
STM32F446.GPIOA.OutputSpeedRegister[10, 2] <- (u8)STM32F446.GPIOSpeed.MEDIUM;

// 4. Pull-up/Pull-down
STM32F446.GPIOA.PullUpDownRegister[10, 2] <- (u8)STM32F446.GPIOPull.NO_PULL;
```

### 3. Register Structure

**Teensy GPIO7 Registers (Simplified):**

| Register  | Offset | Bits | Purpose                         |
| --------- | ------ | ---- | ------------------------------- |
| DR        | 0x00   | 32   | Data Register (RW)              |
| GDIR      | 0x04   | 32   | Direction (1=output)            |
| PSR       | 0x08   | 32   | Pin State (read actual voltage) |
| DR_SET    | 0x84   | 32   | Atomic Set (WO)                 |
| DR_CLEAR  | 0x88   | 32   | Atomic Clear (WO)               |
| DR_TOGGLE | 0x8C   | 32   | Atomic Toggle (WO)              |

**STM32 GPIOA Registers (More Complex):**

| Register | Offset | Bits/Pin | Purpose                            |
| -------- | ------ | -------- | ---------------------------------- |
| MODER    | 0x00   | 2        | Mode (input/output/alt/analog)     |
| OTYPER   | 0x04   | 1        | Output Type (push-pull/open-drain) |
| OSPEEDR  | 0x08   | 2        | Output Speed (4 levels)            |
| PUPDR    | 0x0C   | 2        | Pull-up/Pull-down                  |
| IDR      | 0x10   | 1        | Input Data (RO)                    |
| ODR      | 0x14   | 1        | Output Data (RW)                   |
| BSRR     | 0x18   | 16+16    | Atomic Set (low) / Reset (high)    |

### 4. Memory Map

**Teensy (i.MX RT1062):**

- GPIO7: `0x42004000` (high memory)
- Atomic operations built-in (separate registers)

**Nucleo (STM32F446):**

- RCC: `0x40023800` (peripheral bus)
- GPIOA: `0x40020000` (AHB1 bus)
- Atomic operations via BSRR (single register, 32-bit)

## Code Size Comparison

**Teensy Blink (transpiled C):**

- ~40 lines of generated code
- Minimal initialization (Arduino handles it)
- Binary size: ~500 bytes

**Nucleo Blink (transpiled C):**

- ~260 lines of generated code
- Explicit initialization required
- Binary size: ~812 bytes (with STM32Cube startup)

## Power-On Behavior

**Teensy:**

1. ✅ Powers on at 600 MHz
2. ✅ All clocks enabled
3. ✅ GPIO ready to use immediately
4. ✅ Designed for high-performance applications

**Nucleo:**

1. ⚠️ Powers on at 16 MHz (HSI)
2. ⚠️ All peripherals clocked off
3. ⚠️ Must configure clocks and enable peripherals
4. ✅ Optimized for low-power applications

## Best Practices

### For Teensy Development:

- Leverage Arduino's pinMode() for simplicity
- Use atomic toggle registers for LED control
- Minimal initialization needed

### For STM32 Development:

- Always enable peripheral clocks first
- Configure all GPIO parameters explicitly
- Consider power consumption (disable unused peripherals)
- For 180 MHz: configure PLL, flash wait states, voltage regulator

## C-Next Abstraction Benefits

Both platforms use the **scoped register pattern** in C-Next:

```cnx
// Platform abstraction via scopes
scope Teensy4 { /* i.MX RT1062 registers */ }
scope STM32F446 { /* STM32F446 registers */ }
scope LED { /* Application logic */ }

// Same high-level API:
LED.on();
LED.off();
LED.toggle();
```

This allows:

- ✅ Platform-specific details hidden in scopes
- ✅ Application code (LED scope) is platform-agnostic
- ✅ Clear separation of concerns
- ✅ No HAL/CMSIS conflicts (scoped names)

## When to Choose Each Platform

**Choose Teensy 4.x if:**

- Need high CPU performance (600 MHz)
- Want minimal setup complexity
- Prefer Arduino ecosystem
- Don't need ultra-low power

**Choose Nucleo-F446RE if:**

- Need precise power management
- Want ST ecosystem (STM32CubeIDE, HAL)
- Learning industry-standard STM32
- Budget-conscious (Nucleo is cheaper)

## References

- [Teensy 4.x Hardware Docs](../teensy4/docs/README.md)
- [Nucleo-F446RE Hardware Docs](docs/README.md)
- [i.MX RT1060 Reference Manual](https://www.pjrc.com/teensy/IMXRT1060RM_rev3.pdf)
- [STM32F446 Reference Manual (RM0390)](https://www.st.com/resource/en/reference_manual/rm0390-stm32f446xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)
