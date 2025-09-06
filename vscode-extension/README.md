# c-next Language Support for VS Code

Comprehensive language support for the c-next programming language, providing syntax highlighting, IntelliSense, diagnostics, and more for `.cn` and `.cnm` files.

## Features

### 🎨 Syntax Highlighting
- Full syntax highlighting for c-next language features:
  - Assignment operator `<-`
  - Backtick strings: `` `Hello ${name}!` ``
  - c-next type system: `int16`, `uint8`, `float32`, `String`, etc.
  - Classes, interfaces, and functions
  - Comments and preprocessor directives

### 🧠 IntelliSense & Language Features
- **Real-time Diagnostics**: Error detection and reporting for:
  - Incorrect assignment operators (= vs <-)
  - Invalid type declarations
  - Missing semicolons
  - Undefined functions and variables
  
- **Auto-completion**: Smart suggestions for:
  - c-next keywords and types
  - Arduino functions (pinMode, digitalWrite, delay, etc.)
  - Arduino constants (HIGH, LOW, LED_BUILTIN, etc.)
  - Code snippets for common patterns
  
- **Symbol Analysis**: 
  - Function and variable detection
  - Class and method recognition
  - Include directive processing

### ⚙️ Configuration
- Configurable diagnostic settings
- Adjustable problem reporting limits
- Custom transpiler path support

## Installation

### Quick Install (Recommended)

Use the provided installation script:

```bash
./scripts/install-vscode-extension.sh
```

### Manual Installation

1. Download or build the `.vsix` file
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX"
3. Select the `.vsix` file

### Build from Source

```bash
# Install dependencies
npm install

# Install server dependencies
npm run install-server

# Build the complete extension
npm run compile

# Package the extension
npm run package

# Install the generated .vsix file
code --install-extension cnext-language-support-0.2.0.vsix
```

## Usage

Once installed, VS Code will automatically:
- Recognize `.cn` and `.cnm` files
- Apply syntax highlighting
- Provide IntelliSense features
- Show real-time diagnostics

### Language Server Features

The extension includes a full Language Server Protocol (LSP) implementation that provides:

1. **Syntax Validation**: Real-time error detection
2. **Auto-completion**: Context-aware code suggestions
3. **Symbol Tables**: Cross-file symbol resolution
4. **Diagnostic Reporting**: Detailed error messages with suggestions

### Configuration Options

Add these settings to your VS Code `settings.json`:

```json
{
  "cnextLanguageServer.maxNumberOfProblems": 1000,
  "cnextLanguageServer.enableDiagnostics": true,
  "cnextLanguageServer.transpilerPath": "/path/to/cnext/transpiler"
}
```

## Example

Here's a sample c-next file with the features you'll see:

```c-next
#include "Arduino.h";
import "Blink.cn";

class Blink {
    static uint16 delayMs <- 1000;
    
    public void setup() {
        pinMode(LED_BUILTIN, OUTPUT);
        Serial.begin(115200);
    }

    public void loop() {
        String message <- `LED is blinking every ${delayMs}ms`;
        Serial.println(message);
        
        digitalWrite(LED_BUILTIN, HIGH);
        delay(delayMs);
        digitalWrite(LED_BUILTIN, LOW);
        delay(delayMs);
    }
}
```

### What You'll See:
- ✅ Proper syntax highlighting
- ✅ Auto-completion for Arduino functions
- ✅ Error detection for syntax issues
- ✅ Type checking for variables
- ✅ Symbol recognition across files

## Architecture

This extension uses the Language Server Protocol (LSP) architecture:

```
VSCode Client Extension ←→ Language Server
     ↓                           ↓
- Extension host              - ANTLR parser
- LSP client                  - Symbol analysis
- UI integration              - Diagnostics
                              - Completions
```

### Components:
- **Client (`src/extension.ts`)**: VSCode extension host
- **Server (`server/src/`)**: Language server implementation
- **Shared (`shared/`)**: Common type definitions
- **Parser**: Basic symbol extraction (ANTLR integration planned)

## Contributing

This is part of the larger c-next language project. Report issues or contribute at: https://github.com/jlaustill/c-next

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the server: `npm run build-server`  
4. Start development: `npm run watch`
5. Press `F5` to launch Extension Development Host

## License

MIT License