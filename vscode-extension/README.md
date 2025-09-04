# c-next Language Support for VS Code

Provides syntax highlighting and language support for c-next programming language files (`.cn` and `.cnm`).

## Features

- **Syntax Highlighting**: Full syntax highlighting for c-next language features:
  - Assignment operator `<-`
  - Backtick strings with interpolation: `` `Hello ${name}!` ``
  - c-next type system: `int16`, `uint8`, `float32`, `String`, etc.
  - Interface types: `IAddress`, `IPerson`, etc.
  - Classes, interfaces, and functions
  - Comments and preprocessor directives
  
- **Language Configuration**: 
  - Auto-closing brackets and quotes
  - Comment toggling (`//` and `/* */`)
  - Smart indentation
  - Code folding

## Installation

### Option 1: Install from VSIX (Recommended)

1. Download or build the `.vsix` file
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX"
3. Select the `.vsix` file

### Option 2: Development Installation

1. Clone or copy the extension files to:
   ```
   ~/.vscode/extensions/cnext-syntax-0.1.0/
   ```

2. Restart VS Code

### Option 3: Build from Source

```bash
# Install vsce (VS Code Extension Manager)
npm install -g vsce

# In the extension directory
vsce package

# Install the generated .vsix file
code --install-extension cnext-syntax-0.1.0.vsix
```

## Usage

Once installed, VS Code will automatically recognize `.cn` and `.cnm` files and apply c-next syntax highlighting.

## Syntax Features Highlighted

- **Keywords**: `class`, `interface`, `public`, `static`, `if`, `else`, `for`, etc.
- **Types**: `int16`, `uint32`, `float64`, `String`, `boolean`, interface types (`I*`)
- **Operators**: Assignment `<-`, concatenation `+<-`, arithmetic, comparison
- **Strings**: Backtick strings with `${}` interpolation, quoted strings
- **Functions**: Function declarations, method calls, constructors
- **Preprocessor**: `#include` directives, `import` statements
- **Comments**: Line (`//`) and block (`/* */`) comments

## Example

```c-next
#include "Arduino.h";

class Blink {
    static uint16 delayMs <- 1000;
    
    public void setup() {
        pinMode(LED_BUILTIN, OUTPUT);
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

## Contributing

Report issues or contribute improvements at: https://github.com/jlaustill/c-next

## License

MIT License