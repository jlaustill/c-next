# Teensy 4.x Hardware Documentation

This directory contains reference documentation for developing C-Next examples targeting Teensy 4.0 and 4.1 boards.

## Documents

| File | Description | Source |
|------|-------------|--------|
| `IMXRT1060RM_rev3.pdf` | i.MX RT1060 Processor Reference Manual (29MB) | [NXP via PJRC](https://www.pjrc.com/teensy/IMXRT1060RM_rev3.pdf) |
| `IMXRT1060CEC.pdf` | i.MX RT1060 Electrical Datasheet | [NXP via PJRC](https://www.pjrc.com/teensy/IMXRT1060CEC_rev0_1.pdf) |
| `schematic40.png` | Teensy 4.0 Schematic | [PJRC](https://www.pjrc.com/teensy/schematic40.png) |
| `schematic41.png` | Teensy 4.1 Schematic | [PJRC](https://www.pjrc.com/teensy/schematic41.png) |
| `pinout_card40_front.pdf` | Teensy 4.0 Pinout Card (Front) | [PJRC](https://www.pjrc.com/teensy/card10a_rev2_web.pdf) |
| `pinout_card40_back.pdf` | Teensy 4.0 Pinout Card (Back) | [PJRC](https://www.pjrc.com/teensy/card10b_rev2_web.pdf) |
| `pinout_card41_front.pdf` | Teensy 4.1 Pinout Card (Front) | [PJRC](https://www.pjrc.com/teensy/card11a_rev4_web.pdf) |
| `pinout_card41_back.pdf` | Teensy 4.1 Pinout Card (Back) | [PJRC](https://www.pjrc.com/teensy/card11b_rev4_web.pdf) |

## Downloading the Reference Manual

The i.MX RT1060 Reference Manual is too large for git. If it's missing, download it:

```bash
cd examples/teensy4/docs
curl -L -o IMXRT1060RM_rev3.pdf "https://www.pjrc.com/teensy/IMXRT1060RM_rev3.pdf"
```

## Key Sections in the Reference Manual

For C-Next embedded development, these sections are most useful:

| Section | Page | Content |
|---------|------|---------|
| Chapter 12 | ~300 | IOMUXC - Pin Muxing |
| Chapter 26 | ~949 | GPIO - General Purpose I/O |
| Chapter 26.5 | ~955 | GPIO Register Descriptions |

## GPIO7 Quick Reference

GPIO7 is used for Arduino pins 6-13 and 32 on Teensy 4.x.

**Base Address:** `0x42004000`

| Register | Offset | Access | Description |
|----------|--------|--------|-------------|
| DR | 0x00 | RW | Data Register |
| GDIR | 0x04 | RW | Direction (1=output) |
| PSR | 0x08 | RO | Pad Status (actual pin state) |
| ICR1 | 0x0C | RW | Interrupt Config (pins 0-15) |
| ICR2 | 0x10 | RW | Interrupt Config (pins 16-31) |
| IMR | 0x14 | RW | Interrupt Mask |
| ISR | 0x18 | RW | Interrupt Status (W1C) |
| EDGE_SEL | 0x1C | RW | Edge Select |
| DR_SET | 0x84 | WO | Atomic Set |
| DR_CLEAR | 0x88 | WO | Atomic Clear |
| DR_TOGGLE | 0x8C | WO | Atomic Toggle |

## GPIO7 Pin Mapping (Teensy 4.x)

Source: [PaulStoffregen/cores/teensy4/core_pins.h](https://github.com/PaulStoffregen/cores/blob/master/teensy4/core_pins.h)

### Teensy 4.0 and 4.1 (Common Pins)

| GPIO7 Bit | Arduino Pin | Notes |
|-----------|-------------|-------|
| Bit 0 | Pin 10 | |
| Bit 1 | Pin 12 | |
| Bit 2 | Pin 11 | |
| Bit 3 | Pin 13 | **LED_BUILTIN** |
| Bit 10 | Pin 6 | |
| Bit 11 | Pin 9 | |
| Bit 16 | Pin 8 | |
| Bit 17 | Pin 7 | |

### Teensy 4.1 Additional Pins

| GPIO7 Bit | Arduino Pin | Notes |
|-----------|-------------|-------|
| Bit 12 | Pin 32 | |
| Bit 18 | Pin 36 | |
| Bit 19 | Pin 37 | |
| Bit 28 | Pin 35 | |
| Bit 29 | Pin 34 | |

## Attribution

- **NXP Semiconductors** - i.MX RT1060 documentation
- **PJRC** - Teensy schematics and pinout cards
- Downloaded: 2026-01-03

## License

These documents are provided by their respective copyright holders for reference purposes.
Refer to NXP and PJRC licensing terms for redistribution rights.
