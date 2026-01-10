# Nucleo-F446RE Hardware Documentation

This directory contains reference documentation for developing C-Next examples targeting the Nucleo-F446RE board.

## Documents

| File                                    | Description                  | Source                                                                                                                           |
| --------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `RM0390-STM32F446-Reference-Manual.pdf` | STM32F446xx Reference Manual | [ST.com](https://www.st.com/resource/en/reference_manual/rm0390-stm32f446xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) |
| `STM32F446RE-Datasheet.pdf`             | STM32F446xC/E Datasheet      | [ST.com](https://www.st.com/resource/en/datasheet/stm32f446mc.pdf)                                                               |
| `UM1724-Nucleo64-User-Manual.pdf`       | Nucleo-64 Boards User Manual | [ST.com](https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf)                  |

## Downloading the Documentation

ST's documentation servers may have download protection. To download manually:

```bash
cd examples/nucleo-f446re/docs

# Reference Manual (RM0390) - ~1.5MB
curl -L -o RM0390-STM32F446-Reference-Manual.pdf \
  "https://www.st.com/resource/en/reference_manual/rm0390-stm32f446xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf"

# Datasheet - ~200KB
curl -L -o STM32F446RE-Datasheet.pdf \
  "https://www.st.com/resource/en/datasheet/stm32f446mc.pdf"

# Nucleo-64 User Manual (UM1724) - ~4MB
curl -L -o UM1724-Nucleo64-User-Manual.pdf \
  "https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf"
```

**Note:** If automated downloads fail, visit the [STM32F446 documentation page](https://www.st.com/en/microcontrollers-microprocessors/stm32f446/documentation.html) or [NUCLEO-F446RE product page](https://www.st.com/en/evaluation-tools/nucleo-f446re.html) to download manually.

## Key Sections in the Reference Manual (RM0390)

For C-Next embedded development, these sections are most useful:

| Section     | Page | Content                       |
| ----------- | ---- | ----------------------------- |
| Chapter 6   | ~149 | RCC - Reset and Clock Control |
| Chapter 8   | ~268 | GPIO - General-Purpose I/O    |
| Section 8.4 | ~281 | GPIO Register Descriptions    |

## STM32F446RE Quick Facts

- **Core:** ARM Cortex-M4F @ 180 MHz
- **Flash:** 512 KB
- **RAM:** 128 KB
- **GPIO Ports:** GPIOA through GPIOH (varies by package)

## Nucleo-F446RE Board Details

### User LED

- **Pin:** PA5 (GPIOA, Pin 5)
- **Name:** LD2 (User LED, Green)
- **Active:** High (LED on when pin is HIGH)

### GPIO Port A Base Address

**GPIOA Base:** `0x40020000`

| Register | Offset | Access | Description                      |
| -------- | ------ | ------ | -------------------------------- |
| MODER    | 0x00   | RW     | Mode register (2 bits per pin)   |
| OTYPER   | 0x04   | RW     | Output type register             |
| OSPEEDR  | 0x08   | RW     | Output speed register            |
| PUPDR    | 0x0C   | RW     | Pull-up/pull-down register       |
| IDR      | 0x10   | RO     | Input data register              |
| ODR      | 0x14   | RW     | Output data register             |
| BSRR     | 0x18   | WO     | Bit set/reset register (atomic)  |
| LCKR     | 0x1C   | RW     | Configuration lock register      |
| AFRL     | 0x20   | RW     | Alternate function low register  |
| AFRH     | 0x24   | RW     | Alternate function high register |

### RCC (Reset and Clock Control)

**RCC Base:** `0x40023800`

| Register | Offset | Access | Description                           |
| -------- | ------ | ------ | ------------------------------------- |
| AHB1ENR  | 0x30   | RW     | AHB1 peripheral clock enable register |

**Required Initialization:**

- Enable GPIOA clock: Set bit 0 of RCC_AHB1ENR
- Configure PA5 as output: Set MODER5[1:0] = 0b01 in GPIOA_MODER

## Pin Configuration Modes (MODER)

Each pin uses 2 bits in the MODER register:

| Value | Mode                        |
| ----- | --------------------------- |
| 0b00  | Input (reset state)         |
| 0b01  | General purpose output mode |
| 0b10  | Alternate function mode     |
| 0b11  | Analog mode                 |

For PA5 (LED): bits [11:10] in GPIOA_MODER

## Attribution

- **STMicroelectronics** - STM32F446 documentation and Nucleo board
- Downloaded: 2026-01-10

## License

These documents are provided by STMicroelectronics for reference purposes.
Refer to ST licensing terms for redistribution rights.
