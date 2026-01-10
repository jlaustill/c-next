# Nucleo-F446RE Test Project

PlatformIO project for testing C-Next transpiled code on the ST Nucleo-F446RE board.

## Hardware Requirements

- **Board**: Nucleo-F446RE
- **MCU**: STM32F446RE (ARM Cortex-M4F @ 180 MHz max)
- **Built-in LED**: LD2 (green) on PA5
- **Programmer**: ST-Link V2-1 (built into Nucleo board)

## Setup

### 1. Install PlatformIO

```bash
# Using Python pip
pip install platformio

# Or using PlatformIO IDE (VS Code extension)
# Install "PlatformIO IDE" extension in VS Code
```

### 2. Build the Project

```bash
cd examples/nucleo-f446re/test-nucleo
pio run
```

### 3. Upload to Board

```bash
# Connect Nucleo board via USB (ST-Link connector)
pio run -t upload
```

The green LED (LD2) should start blinking at 0.5 Hz (500ms on, 500ms off).

## Project Structure

```
test-nucleo/
├── platformio.ini    # PlatformIO configuration
├── src/
│   └── main.c        # Transpiled C-Next code (from ../blink.cnx)
└── README.md         # This file
```

## Regenerating from C-Next Source

To regenerate `src/main.c` from the C-Next source:

```bash
# From c-next repository root
cd examples/nucleo-f446re
cnext blink.cnx -o test-nucleo/src/main.c
```

## Build Configuration

- **Platform**: ST STM32 (ststm32)
- **Framework**: STM32Cube (provides CMSIS and startup code)
- **Upload**: ST-Link (built into Nucleo board)
- **Optimization**: `-Os` (optimize for size)

## Clock Configuration

The example runs on the default **16 MHz HSI** (internal oscillator) for simplicity.

For maximum performance (180 MHz):

1. Configure HSE (8 MHz external crystal on Nucleo)
2. Set up PLL with appropriate multipliers/dividers
3. Configure flash wait states
4. Switch system clock to PLL

## Debugging

```bash
# Start debugging session
pio debug

# Or use VS Code with PlatformIO extension
# Set breakpoints and press F5
```

## Serial Monitor

Although this example doesn't use UART, you can add serial output:

```bash
pio device monitor
```

## Troubleshooting

### Upload fails

- Ensure ST-Link drivers are installed
- Check USB connection to CN1 (ST-Link USB connector, not CN2)
- Try: `pio run -t upload --upload-port /dev/ttyACM0` (adjust port as needed)

### LED doesn't blink

- Verify board power (LED4 should be on)
- Check that code uploaded successfully (see terminal output)
- Try pressing the black RESET button (B2)

### Build errors

- Ensure PlatformIO is up to date: `pio upgrade`
- Clean build: `pio run -t clean`
- Check that STM32 platform is installed: `pio platform install ststm32`

## License

MIT
