# C-Next

[![npm version](https://img.shields.io/npm/v/c-next)](https://www.npmjs.com/package/c-next)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=jlaustill_c-next&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=jlaustill_c-next)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=jlaustill_c-next&metric=coverage)](https://sonarcloud.io/summary/overall?id=jlaustill_c-next)
[![Coverage Report](https://img.shields.io/badge/Coverage-Report-blue)](https://jlaustill.github.io/c-next/coverage/)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=jlaustill_c-next&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=jlaustill_c-next)
[![CI](https://github.com/jlaustill/c-next/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/jlaustill/c-next/actions/workflows/pr-checks.yml)

A safer C for embedded systems development. Transpiles to clean, readable C.

**Status: Working Transpiler** — Verified on Teensy MicroMod, 4.0, and stm32 hardware.

## Quick Example

```cnx
// Register binding with type-safe access
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,
    DR_SET:     u32 wo @ 0x84,
    DR_TOGGLE:  u32 wo @ 0x8C,
}

u32 LED_BIT <- 3;

scope LED {
    void toggle() {
        // Type-aware bit indexing on write-only register
        GPIO7.DR_TOGGLE[LED_BIT] <- true;
    }
}
```

Generates clean C:

```c
#define GPIO7_DR_TOGGLE (*(volatile uint32_t*)(0x42004000 + 0x8C))

uint32_t LED_BIT = 3;

void LED_toggle(void) {
    GPIO7_DR_TOGGLE = (1 << LED_BIT);
}
```

## Why C-Next?

C-Next transpiles to **standard C99**. Your existing toolchain — GCC, Clang, IAR, arm-none-eabi-gcc — compiles the output.

This means:

- **50+ years of GCC optimizations** work out of the box
- **Existing debuggers and profilers** just work (GDB, Ozone, etc.)
- **No new runtime** — the generated C is what runs on your hardware
- **Incremental adoption** — drop a single `.cnx` file into an existing project

Other memory-safe languages require adopting an entirely new toolchain, build system, and ecosystem. C-Next gives you safety improvements while keeping your investment in C infrastructure.

## Philosophy

C-Next follows the TypeScript model for adoption:

1. **Not all-or-nothing** — Drop a single `.cnx` file into an existing C project
2. **Clean escape hatch** — Generated C is idiomatic and maintainable
3. **Helpful, not burdensome** — If you know C, you can read C-Next immediately

### Core Principles

**KISS (Keep It Simple, Stupid)**
Every feature must pass the simplicity test: "Can a senior C developer read this cold and understand it in 30 seconds?" If not, it's too clever.

**DRY (Don't Repeat Yourself)**
Configuration belongs in one place. No magic numbers scattered through code. Named constants and register bindings enforce single sources of truth.

**Pragmatic, Not Dogmatic**
C-Next makes the right thing easy and the wrong thing hard, but doesn't prevent escape hatches. Generated C is always readable and maintainable.

### C Preprocessor Compatibility

C-Next uses the standard C preprocessor — no custom module system. This means:

- `#include` directives pass through to generated C
- Include C-Next files: `#include "utils.cnx"` → `#include "utils.h"` in generated C
- Works with both `<file.cnx>` and `"file.cnx"` syntax
- MISRA preprocessor guidelines apply
- Full compatibility with existing toolchains (PlatformIO, arm-gcc, etc.)
- Conditional compilation (`#ifdef`) works as expected

Generated headers automatically include guards:

```c
#ifndef MYFILE_H
#define MYFILE_H
// ...
#endif /* MYFILE_H */
```

### The Simplicity Constraint

| Rust's Path                  | C-Next's Path                           |
| ---------------------------- | --------------------------------------- |
| Add concepts to catch errors | Remove the ability to make errors       |
| Borrow checker complexity    | Startup allocation = predictable memory |
| Lifetime annotations         | Fixed runtime layout = clear lifetimes  |
| `unsafe` escape hatch        | No escape hatch needed!                 |

**Guiding Principle:** If Linus Torvalds wouldn't approve of the complexity, it doesn't ship. Safety through removal, not addition.

## Installation

### From npm (Recommended)

```bash
npm install -g c-next
```

Verify the installation:

```bash
cnext --version
```

### From Source (Development)

```bash
git clone https://github.com/jlaustill/c-next.git
cd c-next
npm install
npm link
```

## Usage

```bash
# Transpile to C (output alongside input file)
cnext examples/blink.cnx

# Explicit output path
cnext examples/blink.cnx -o blink.c

# Parse only (syntax check)
cnext examples/blink.cnx --parse

# Output as C++ (.cpp)
cnext examples/blink.cnx --cpp

# Target platform for atomic code generation (ADR-049)
cnext examples/blink.cnx --target teensy41

# Separate output directories for code and headers
cnext src/main.cnx -o build/src --header-out build/include

# Clean generated files
cnext src/main.cnx -o build/src --header-out build/include --clean

# Show all options
cnext --help
```

## VS Code Extension

The C-Next VS Code extension provides syntax highlighting, live C preview, IntelliSense, and error diagnostics.

**Install from:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jlaustill.vscode-c-next) (coming soon)

**Source:** [github.com/jlaustill/vscode-c-next](https://github.com/jlaustill/vscode-c-next)

## Getting Started with PlatformIO

C-Next integrates seamlessly with PlatformIO. Quick setup:

```bash
cnext --pio-install
```

This creates a pre-build script that automatically transpiles `.cnx` files before each build.

**Full guide:** See [PlatformIO Integration](docs/platformio-integration.md) for the complete workflow including why you should commit generated files.

## Projects Using C-Next

| Project                                   | Description                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| [OSSM](https://github.com/jlaustill/ossm) | Open-source stroke machine firmware using C-Next for safe embedded control         |
| [test-teensy](test-teensy/)               | Hardware verification project — validates transpiler output on Teensy MicroMod/4.0 |

_Using C-Next in your project? Open an issue to get listed!_

## Documentation

| Resource                                                      | Description                                |
| ------------------------------------------------------------- | ------------------------------------------ |
| [Language Guide](docs/language-guide.md)                      | Complete reference for all C-Next features |
| [Architecture Decisions](docs/architecture-decisions.md)      | 50+ ADRs documenting design choices        |
| [Learn C-Next in Y Minutes](docs/learn-cnext-in-y-minutes.md) | Quick syntax overview                      |
| [Error Codes](docs/error-codes.md)                            | Compiler error reference                   |
| [MISRA Compliance](docs/misra-compliance.md)                  | MISRA C:2012 compliance details            |

## Project Structure

```
c-next/
├── grammar/CNext.g4                    # ANTLR4 grammar definition
├── src/
│   ├── index.ts                        # CLI entry point
│   ├── transpiler/
│   │   ├── Transpiler.ts               # Orchestrator
│   │   ├── data/                       # Discovery layer (files, includes, deps)
│   │   ├── logic/                      # Business logic (parser, symbols, analysis)
│   │   └── output/                     # Generation (codegen, headers)
│   └── utils/                          # Shared utilities
├── examples/
│   ├── blink.cnx                       # LED blink (Teensy verified)
│   └── bit_test.cnx                    # Bit manipulation tests
├── test-teensy/                        # PlatformIO test project
└── docs/decisions/                     # Architecture Decision Records
```

## Development

### Setup

```bash
# Clone and install (IMPORTANT: npm install sets up pre-commit hooks)
git clone https://github.com/jlaustill/c-next.git
cd c-next
npm install  # Installs dependencies and Husky pre-commit hooks
```

**Pre-commit hooks:** The project uses [Husky](https://typicode.github.io/husky/) to automatically format code (Prettier) and fix linting (ESLint) before every commit. This prevents formatting errors in PRs.

### Commands

```bash
npm run antlr      # Regenerate parser from grammar
npm run typecheck  # Type-check TypeScript (no build required)
npm test                              # Run all tests
npm test -- --quiet                   # Minimal output (errors + summary only)
npm test -- tests/enum                # Run specific directory
npm test -- tests/enum/my.test.cnx    # Run single test file

# Code quality (auto-run by pre-commit hooks)
npm run prettier:fix   # Format all code
npm run eslint:check   # Check for lint errors

# Coverage tracking
npm run coverage:check           # Feature coverage report
npm run coverage:grammar         # Grammar rule coverage (generates GRAMMAR-COVERAGE.md)
npm run coverage:grammar:check   # Grammar coverage with threshold check (CI)
```

**Note:** C-Next runs directly via `tsx` without a build step. The `typecheck` command validates types only and does not generate any output files.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete development workflow, testing requirements, and PR process.

**Quick start:** Ideas and feedback welcome via issues.

## License

MIT

## Acknowledgments

- The R community for proving `<-` works in practice
- MISRA C consortium for codifying embedded safety wisdom
- The TypeScript team for demonstrating gradual adoption works
- ANTLR for the parser infrastructure
