# ESP32-S3 GPIO Register Definitions Design

**Date:** 2026-01-30
**Status:** Ready for Implementation
**Goal:** Define complete ESP32-S3 GPIO peripheral registers in C-Next for embedded development

## Overview

This design defines the ESP32-S3 GPIO and IO_MUX registers using C-Next's `register` and `bitmap32` constructs. The goal is to provide a type-safe, readable interface for direct hardware access on ESP32-S3 microcontrollers.

## Reference Documentation

- [ESP32-S3 Technical Reference Manual](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf) - Chapter 6: IO MUX and GPIO Matrix
- Local copy: `~/code/c-next/Esp32-s3_technical_reference_manual_en.pdf`

## Hardware Overview

The ESP32-S3 has:

- 45 physical GPIO pins: GPIO0-GPIO21 and GPIO26-GPIO48
- GPIO22-GPIO25 do not exist (reserved for internal flash/PSRAM)
- Two register banks: GPIO0-31 and GPIO32-48
- Atomic bit manipulation via W1TS (write-1-to-set) and W1TC (write-1-to-clear) registers

### Base Addresses

| Peripheral | Base Address |
| ---------- | ------------ |
| GPIO       | 0x60004000   |
| IO_MUX     | 0x60009000   |

## Design

### 1. GPIO Pin Bitmaps

Define bitmap types for each GPIO bank to enable named pin access:

```cnx
// GPIO pins 0-31 (one bit per pin)
bitmap32 GPIOPins0_31 {
    GPIO0,  GPIO1,  GPIO2,  GPIO3,  GPIO4,  GPIO5,  GPIO6,  GPIO7,
    GPIO8,  GPIO9,  GPIO10, GPIO11, GPIO12, GPIO13, GPIO14, GPIO15,
    GPIO16, GPIO17, GPIO18, GPIO19, GPIO20, GPIO21, Reserved22, Reserved23,
    Reserved24, Reserved25, GPIO26, GPIO27, GPIO28, GPIO29, GPIO30, GPIO31
}

// GPIO pins 32-48 (bits 0-16 used, rest reserved)
bitmap32 GPIOPins32_48 {
    GPIO32, GPIO33, GPIO34, GPIO35, GPIO36, GPIO37, GPIO38, GPIO39,
    GPIO40, GPIO41, GPIO42, GPIO43, GPIO44, GPIO45, GPIO46, GPIO47,
    GPIO48, Reserved[15]  // bits 17-31 unused
}
```

### 2. GPIO Core Registers

```cnx
register GPIO @ 0x60004000 {
    // Output registers (GPIO 0-31)
    OUT:          GPIOPins0_31  rw @ 0x0004,   // Output value
    OUT_W1TS:     GPIOPins0_31  wo @ 0x0008,   // Set bits (atomic)
    OUT_W1TC:     GPIOPins0_31  wo @ 0x000C,   // Clear bits (atomic)

    // Output registers (GPIO 32-48)
    OUT1:         GPIOPins32_48 rw @ 0x0010,
    OUT1_W1TS:    GPIOPins32_48 wo @ 0x0014,
    OUT1_W1TC:    GPIOPins32_48 wo @ 0x0018,

    // Output enable registers (GPIO 0-31)
    ENABLE:       GPIOPins0_31  rw @ 0x0020,
    ENABLE_W1TS:  GPIOPins0_31  wo @ 0x0024,
    ENABLE_W1TC:  GPIOPins0_31  wo @ 0x0028,

    // Output enable registers (GPIO 32-48)
    ENABLE1:      GPIOPins32_48 rw @ 0x002C,
    ENABLE1_W1TS: GPIOPins32_48 wo @ 0x0030,
    ENABLE1_W1TC: GPIOPins32_48 wo @ 0x0034,

    // Strapping pin register
    STRAP:        u32           ro @ 0x0038,

    // Input registers
    IN:           GPIOPins0_31  ro @ 0x003C,
    IN1:          GPIOPins32_48 ro @ 0x0040,

    // Interrupt status registers
    STATUS:       GPIOPins0_31  rw @ 0x0044,
    STATUS_W1TS:  GPIOPins0_31  wo @ 0x0048,
    STATUS_W1TC:  GPIOPins0_31  wo @ 0x004C,
    STATUS1:      GPIOPins32_48 rw @ 0x0050,
    STATUS1_W1TS: GPIOPins32_48 wo @ 0x0054,
    STATUS1_W1TC: GPIOPins32_48 wo @ 0x0058,

    // Per-pin configuration (GPIO_PINn_REG)
    PIN0:  GPIOPinConfig rw @ 0x0074,
    PIN1:  GPIOPinConfig rw @ 0x0078,
    PIN2:  GPIOPinConfig rw @ 0x007C,
    PIN3:  GPIOPinConfig rw @ 0x0080,
    PIN4:  GPIOPinConfig rw @ 0x0084,
    PIN5:  GPIOPinConfig rw @ 0x0088,
    PIN6:  GPIOPinConfig rw @ 0x008C,
    PIN7:  GPIOPinConfig rw @ 0x0090,
    PIN8:  GPIOPinConfig rw @ 0x0094,
    PIN9:  GPIOPinConfig rw @ 0x0098,
    PIN10: GPIOPinConfig rw @ 0x009C,
    PIN11: GPIOPinConfig rw @ 0x00A0,
    PIN12: GPIOPinConfig rw @ 0x00A4,
    PIN13: GPIOPinConfig rw @ 0x00A8,
    PIN14: GPIOPinConfig rw @ 0x00AC,
    PIN15: GPIOPinConfig rw @ 0x00B0,
    PIN16: GPIOPinConfig rw @ 0x00B4,
    PIN17: GPIOPinConfig rw @ 0x00B8,
    PIN18: GPIOPinConfig rw @ 0x00BC,
    PIN19: GPIOPinConfig rw @ 0x00C0,
    PIN20: GPIOPinConfig rw @ 0x00C4,
    PIN21: GPIOPinConfig rw @ 0x00C8,
    // PIN22-25 don't exist
    PIN26: GPIOPinConfig rw @ 0x00DC,
    PIN27: GPIOPinConfig rw @ 0x00E0,
    PIN28: GPIOPinConfig rw @ 0x00E4,
    PIN29: GPIOPinConfig rw @ 0x00E8,
    PIN30: GPIOPinConfig rw @ 0x00EC,
    PIN31: GPIOPinConfig rw @ 0x00F0,
    PIN32: GPIOPinConfig rw @ 0x00F4,
    PIN33: GPIOPinConfig rw @ 0x00F8,
    PIN34: GPIOPinConfig rw @ 0x00FC,
    PIN35: GPIOPinConfig rw @ 0x0100,
    PIN36: GPIOPinConfig rw @ 0x0104,
    PIN37: GPIOPinConfig rw @ 0x0108,
    PIN38: GPIOPinConfig rw @ 0x010C,
    PIN39: GPIOPinConfig rw @ 0x0110,
    PIN40: GPIOPinConfig rw @ 0x0114,
    PIN41: GPIOPinConfig rw @ 0x0118,
    PIN42: GPIOPinConfig rw @ 0x011C,
    PIN43: GPIOPinConfig rw @ 0x0120,
    PIN44: GPIOPinConfig rw @ 0x0124,
    PIN45: GPIOPinConfig rw @ 0x0128,
    PIN46: GPIOPinConfig rw @ 0x012C,
    PIN47: GPIOPinConfig rw @ 0x0130,
    PIN48: GPIOPinConfig rw @ 0x0134,
}
```

### 3. GPIO Pin Configuration Bitmap

```cnx
enum GPIOIntType {
    DISABLED     <- 0,  // GPIO interrupt disabled
    RISING_EDGE  <- 1,  // Rising edge trigger
    FALLING_EDGE <- 2,  // Falling edge trigger
    ANY_EDGE     <- 3,  // Any edge trigger
    LOW_LEVEL    <- 4,  // Low level trigger
    HIGH_LEVEL   <- 5   // High level trigger
}

bitmap32 GPIOPinConfig {
    SYNC2_BYPASS[2],    // bits 0-1: Second stage sync
    PAD_DRIVER,         // bit 2: 0=push-pull, 1=open drain
    SYNC1_BYPASS[2],    // bits 3-4: First stage sync
    Reserved_5[2],      // bits 5-6
    INT_TYPE[3],        // bits 7-9: Interrupt type
    WAKEUP_ENABLE,      // bit 10: Wake from light-sleep
    Reserved_11[2],     // bits 11-12
    INT_ENA[2],         // bits 13-14: CPU int enable
    Reserved_15[17]     // bits 15-31
}
```

### 4. IO_MUX Registers

```cnx
enum IODriveStrength {
    DRIVE_5MA  <- 0,
    DRIVE_10MA <- 1,
    DRIVE_20MA <- 2,
    DRIVE_40MA <- 3
}

bitmap32 IOMuxPinConfig {
    MCU_OE,          // bit 0: Output enable in sleep mode
    SLP_SEL,         // bit 1: Sleep mode selection
    MCU_WPD,         // bit 2: Pull-down during sleep
    MCU_WPU,         // bit 3: Pull-up during sleep
    MCU_IE,          // bit 4: Input enable during sleep
    MCU_DRV[2],      // bits 5-6: Drive strength during sleep
    FUN_WPD,         // bit 7: Pull-down enable
    FUN_WPU,         // bit 8: Pull-up enable
    FUN_IE,          // bit 9: Input enable
    FUN_DRV[2],      // bits 10-11: Drive strength
    MCU_SEL[3],      // bits 12-14: Function select (0=GPIO)
    FILTER_EN,       // bit 15: Input glitch filter
    Reserved[16]     // bits 16-31
}

register IO_MUX @ 0x60009000 {
    PIN_CTRL: u32 rw @ 0x0000,
    GPIO0:  IOMuxPinConfig rw @ 0x0004,
    GPIO1:  IOMuxPinConfig rw @ 0x0008,
    GPIO2:  IOMuxPinConfig rw @ 0x000C,
    GPIO3:  IOMuxPinConfig rw @ 0x0010,
    GPIO4:  IOMuxPinConfig rw @ 0x0014,
    GPIO5:  IOMuxPinConfig rw @ 0x0018,
    GPIO6:  IOMuxPinConfig rw @ 0x001C,
    GPIO7:  IOMuxPinConfig rw @ 0x0020,
    GPIO8:  IOMuxPinConfig rw @ 0x0024,
    GPIO9:  IOMuxPinConfig rw @ 0x0028,
    GPIO10: IOMuxPinConfig rw @ 0x002C,
    GPIO11: IOMuxPinConfig rw @ 0x0030,
    GPIO12: IOMuxPinConfig rw @ 0x0034,
    GPIO13: IOMuxPinConfig rw @ 0x0038,
    GPIO14: IOMuxPinConfig rw @ 0x003C,
    GPIO15: IOMuxPinConfig rw @ 0x0040,
    GPIO16: IOMuxPinConfig rw @ 0x0044,
    GPIO17: IOMuxPinConfig rw @ 0x0048,
    GPIO18: IOMuxPinConfig rw @ 0x004C,
    GPIO19: IOMuxPinConfig rw @ 0x0050,
    GPIO20: IOMuxPinConfig rw @ 0x0054,
    GPIO21: IOMuxPinConfig rw @ 0x0058,
    // GPIO22-25 don't exist
    GPIO26: IOMuxPinConfig rw @ 0x006C,
    GPIO27: IOMuxPinConfig rw @ 0x0070,
    GPIO28: IOMuxPinConfig rw @ 0x0074,
    GPIO29: IOMuxPinConfig rw @ 0x0078,
    GPIO30: IOMuxPinConfig rw @ 0x007C,
    GPIO31: IOMuxPinConfig rw @ 0x0080,
    GPIO32: IOMuxPinConfig rw @ 0x0084,
    GPIO33: IOMuxPinConfig rw @ 0x0088,
    GPIO34: IOMuxPinConfig rw @ 0x008C,
    GPIO35: IOMuxPinConfig rw @ 0x0090,
    GPIO36: IOMuxPinConfig rw @ 0x0094,
    GPIO37: IOMuxPinConfig rw @ 0x0098,
    GPIO38: IOMuxPinConfig rw @ 0x009C,
    GPIO39: IOMuxPinConfig rw @ 0x00A0,
    GPIO40: IOMuxPinConfig rw @ 0x00A4,
    GPIO41: IOMuxPinConfig rw @ 0x00A8,
    GPIO42: IOMuxPinConfig rw @ 0x00AC,
    GPIO43: IOMuxPinConfig rw @ 0x00B0,
    GPIO44: IOMuxPinConfig rw @ 0x00B4,
    GPIO45: IOMuxPinConfig rw @ 0x00B8,
    GPIO46: IOMuxPinConfig rw @ 0x00BC,
    GPIO47: IOMuxPinConfig rw @ 0x00C0,
    GPIO48: IOMuxPinConfig rw @ 0x00C4,
}
```

## Usage Examples

### Configure GPIO as Output

```cnx
void configureOutput(u8 pin) {
    // Set IO_MUX to GPIO function, output mode
    IO_MUX.GPIO2.MCU_SEL <- 0;                              // GPIO function
    IO_MUX.GPIO2.FUN_IE <- false;                           // Disable input
    IO_MUX.GPIO2.FUN_WPU <- false;                          // No pull-up
    IO_MUX.GPIO2.FUN_WPD <- false;                          // No pull-down
    IO_MUX.GPIO2.FUN_DRV <- (u8)IODriveStrength.DRIVE_20MA;

    // Enable output
    GPIO.ENABLE_W1TS.GPIO2 <- true;
}
```

### Configure GPIO as Input with Pull-up

```cnx
void configureInput() {
    IO_MUX.GPIO4.MCU_SEL <- 0;        // GPIO function
    IO_MUX.GPIO4.FUN_IE <- true;      // Enable input
    IO_MUX.GPIO4.FUN_WPU <- true;     // Enable pull-up
    IO_MUX.GPIO4.FUN_WPD <- false;    // Disable pull-down
    IO_MUX.GPIO4.FILTER_EN <- true;   // Enable glitch filter

    // Disable output
    GPIO.ENABLE_W1TC.GPIO4 <- true;
}
```

### Atomic Pin Manipulation

```cnx
// Set pin high (atomic, no read-modify-write)
GPIO.OUT_W1TS.GPIO2 <- true;

// Set pin low (atomic)
GPIO.OUT_W1TC.GPIO2 <- true;

// Read pin state
bool state <- GPIO.IN.GPIO4;

// Read output latch
bool outputState <- GPIO.OUT.GPIO2;
```

### LED Blink Example

```cnx
scope LED {
    public void init() {
        IO_MUX.GPIO2.MCU_SEL <- 0;
        IO_MUX.GPIO2.FUN_IE <- false;
        IO_MUX.GPIO2.FUN_WPU <- false;
        IO_MUX.GPIO2.FUN_WPD <- false;
        IO_MUX.GPIO2.FUN_DRV <- (u8)IODriveStrength.DRIVE_20MA;
        GPIO.ENABLE_W1TS.GPIO2 <- true;
        GPIO.OUT_W1TC.GPIO2 <- true;
    }

    public void on() {
        GPIO.OUT_W1TS.GPIO2 <- true;
    }

    public void off() {
        GPIO.OUT_W1TC.GPIO2 <- true;
    }

    public void toggle() {
        if (GPIO.OUT.GPIO2) {
            this.off();
        } else {
            this.on();
        }
    }
}
```

## File Structure

```
examples/
  esp32-s3/
    esp32s3-gpio.cnx      # GPIO and IO_MUX register definitions
    blink.cnx             # LED blink example
```

## Implementation Notes

1. **No clock enable required**: Unlike STM32, ESP32-S3 GPIO is always clocked
2. **Atomic operations**: Use W1TS/W1TC for interrupt-safe bit manipulation
3. **Function selection**: IO_MUX.MCU_SEL must be 0 for GPIO function
4. **Reserved pins**: GPIO22-25 don't exist; GPIO26-32 often used for flash/PSRAM

## Testing Plan

1. Transpile the register definitions and verify generated C is correct
2. Flash to actual ESP32-S3 hardware
3. Verify LED blink works
4. Test input with button/switch
5. Verify atomic operations work correctly in ISR context

## Future Extensions

- UART registers for serial debugging
- SPI/I2C for sensor communication
- Timer registers for proper delays
- RTC GPIO for deep sleep wake-up
