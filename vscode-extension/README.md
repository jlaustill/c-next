# C-Next for VS Code

Syntax highlighting and live C preview for **C-Next**, a safer C for embedded systems.

## Features

### Syntax Highlighting

Full syntax highlighting for `.cnx` files including:

- Keywords (`register`, `namespace`, `if`, `for`, etc.)
- Types (`u8`, `u32`, `bool`, etc.)
- Operators (`<-` assignment, `@` address)
- Literals, comments, strings

### Live C Preview

See your C-Next code transpiled to C in real-time:

- **Open Preview**: `Ctrl+Shift+V` (current column) or `Ctrl+K V` (side by side)
- Updates as you type (debounced)
- Shows last successful output when errors occur
- Line numbers in preview

### Error Diagnostics

- Inline error squiggles in editor
- Full error messages in Problems panel
- Status bar indicator

## Commands

| Command                          | Keybinding     | Description                    |
| -------------------------------- | -------------- | ------------------------------ |
| C-Next: Open Preview             | `Ctrl+Shift+V` | Open preview in current column |
| C-Next: Open Preview to the Side | `Ctrl+K V`     | Open preview beside editor     |

## Settings

| Setting                         | Default | Description                        |
| ------------------------------- | ------- | ---------------------------------- |
| `cnext.preview.updateDelay`     | `300`   | Delay (ms) before updating preview |
| `cnext.preview.showLineNumbers` | `true`  | Show line numbers in preview       |

## Example

```cnx
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,
    DR_SET:     u32 wo @ 0x84,
    DR_TOGGLE:  u32 wo @ 0x8C,
}

u32 LED_BIT <- 3;

namespace LED {
    void toggle() {
        GPIO7.DR_TOGGLE[LED_BIT] <- true;
    }
}
```

Generates:

```c
#define GPIO7_DR_TOGGLE (*(volatile uint32_t*)(0x42004000 + 0x8C))

uint32_t LED_BIT = 3;

void LED_toggle(void) {
    GPIO7_DR_TOGGLE = (1 << LED_BIT);
}
```

## About C-Next

C-Next is a safer C for embedded systems that transpiles to clean, readable C code.

Key features:

- `<-` for assignment (eliminates `if (x = 5)` bugs)
- Fixed-width types (`u8`, `u32`, etc.)
- Type-safe register bindings
- Type-aware bit indexing
- Static allocation only (no heap)

Learn more: [github.com/jlaustill/c-next](https://github.com/jlaustill/c-next)

## Troubleshooting

### "Unknown type 'register'" error

If you see an error like `Unknown type 'register' cnext(unknown-type)`, this is NOT from the C-Next extension. It may be caused by the C/C++ extension applying IntelliSense to `.cnx` files.

**Solution:** Add this to your VS Code settings (`settings.json`):

```json
{
  "C_Cpp.files.exclude": {
    "**/*.cnx": true
  }
}
```

To verify which extension is producing an error:

1. Hover over the error squiggle
2. Click "Quick Fix" or look at the source in the Problems panel
3. C-Next errors show source as "C-Next" (not "cnext")

### Other issues

- **Reload Window**: Try `Ctrl+Shift+P` → "Developer: Reload Window"
- **Check Output**: `Ctrl+Shift+P` → "Output: Focus on Output View" → Select "C-Next" from dropdown

## License

MIT
