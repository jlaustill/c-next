# c-next Blink Example for Teensy

This is a complete PlatformIO project demonstrating how to use c-next with Teensy microcontrollers. It shows the classic "Blink" example - turning an LED on and off - but written in the memory-safe c-next language.

## 🎯 What This Demonstrates

- **c-next to C transpilation** integrated into PlatformIO build process
- **Class-based architecture** with c-next syntax
- **String interpolation** with backtick strings and `${variable}` syntax
- **Type-safe programming** with explicit types like `uint16`, `boolean`, `String`
- **Assignment operator** using `<-` instead of `=`
- **Arduino integration** via `#include` directives

## 📁 Project Structure

```
blink/
├── platformio.ini          # PlatformIO configuration with c-next integration
├── package.json            # TypeScript dependencies for build script
├── cnext-build.ts          # Pre-build script for c-next transpilation
├── src/
│   ├── main.cnm           # Main c-next file (entry point)
│   └── Blink.cn           # Blink class definition
├── generated/             # Auto-generated C files (created during build)
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

1. **PlatformIO** installed (via VS Code extension or CLI)
2. **Node.js and npm** for TypeScript build script
3. **c-next transpiler** available in your PATH

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Ensure c-next is available:**
   ```bash
   # Option 1: Build and link from c-next project root
   cd /path/to/c-next
   npm run build
   npm link
   
   # Option 2: Add c-next to PATH or use absolute path in cnext-build.ts
   ```

3. **Open in PlatformIO:**
   - Open this folder in VS Code with PlatformIO extension
   - PlatformIO should recognize the `platformio.ini` file

### Build and Upload

```bash
# Build the project (automatically transpiles c-next files first)
pio run

# Upload to Teensy
pio run --target upload

# Monitor serial output
pio device monitor

# Or use npm scripts
npm run build
npm run upload
npm run monitor
```

## 🔧 How It Works

### Build Process

1. **Pre-build:** PlatformIO runs `cnext-build.ts` via TypeScript
2. **Transpilation:** The script finds `.cn` and `.cnm` files and runs c-next transpiler
3. **Generation:** C files are created in `generated/` directory
4. **Compilation:** PlatformIO compiles the generated C files for Teensy
5. **Upload:** Standard Arduino/Teensy upload process

### File Types

- **`.cnm` files:** Main files that can contain global objects and functions (like Arduino's `.ino`)
- **`.cn` files:** Class/interface definitions (one per file)

### Generated Output

The c-next files are transpiled to:
- `generated/blink.h` - Header with function declarations
- `generated/blink.c` - Implementation with Blink class functions
- Functions are prefixed with class name: `Blink_setup()`, `Blink_loop()`, etc.

## 📝 Code Overview

### `Blink.cn` - Class Definition
- Demonstrates c-next class syntax
- Uses `<-` assignment operator
- Shows string interpolation: `` `Blink #${count}` ``
- Type-safe with explicit types: `uint16`, `boolean`, `String`

### `main.cnm` - Entry Point  
- Creates global Blink instance
- Standard Arduino `setup()` and `loop()` functions
- Shows `import` directive for including c-next classes

## 🎨 c-next Language Features Shown

```c-next
// Assignment with <-
uint16 delayMs <- 1000;

// String interpolation with backticks
String message <- `Blink #${count} - LED ON for ${delayMs}ms`;

// Type-safe declarations
boolean isBlinking <- false;

// Class constructors
public Blink() {
    delayMs <- 1000;
}

// String concatenation
String welcome <- `Starting on ` +<- boardType;
```

## 🔍 Expected Output

When running on Teensy, you should see:

```
🚀 Starting c-next Blink example on Teensy!
Starting blink on Teensy 4.1
Blink #1 - LED ON for 1000ms
Blink #2 - LED ON for 1000ms
Blink #3 - LED ON for 1000ms
...
```

Plus the built-in LED will blink every second!

## 🐛 Troubleshooting

**"c-next: command not found":**
- Make sure c-next transpiler is built (`npm run build` in c-next project)
- Link globally (`npm link` in c-next project) or update path in `cnext-build.ts`

**"No c-next files found":**
- Ensure `.cn` and `.cnm` files are in the `src/` directory
- Check file extensions are exactly `.cn` and `.cnm`

**Build fails after transpilation:**
- Check generated C files in `generated/` directory
- Verify Arduino libraries are available for your board

## 🎉 Next Steps

Once this works, try:
- Modifying the blink delay
- Adding more classes
- Using interfaces for dependency injection
- Exploring more c-next language features

Happy coding with c-next! 🚀