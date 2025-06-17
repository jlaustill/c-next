# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

c-next is a transpiler for a new low-level, memory-safe programming language that compiles to C/C++. The language enforces strict type safety, eliminates implicit type coercion, and provides automatic memory management while maintaining high performance for systems programming.

## Build System & Commands

**Generate ANTLR parser code:**
```bash
npm run antlr4ts
```

**Build the project:**
```bash
npm run build
```

**Run the compiler:**
```bash
npm start [input_dir] [output_dir]
# Defaults: input_dir=./src, output_dir=./dist
```

**Complete build and run process:**
```bash
npm run build && npm start test-files output
```

## Architecture

The transpiler follows a traditional compiler architecture:

1. **Grammar Definition** (`cNext.g4`): ANTLR4 grammar defining c-next language syntax
2. **Generated Parser** (`src/parser/`): Auto-generated lexer, parser, and visitor interfaces
3. **Code Generation** (`src/visitors/CGenerationVisitor.ts`): Main visitor that transforms AST to C code
4. **Compiler Driver** (`src/index.ts`): Orchestrates the compilation process

### Key Components

- **CGenerationVisitor**: Core transpilation logic that converts c-next classes to C header/implementation files
- **Compiler class**: Handles file discovery, parsing, and orchestrates the compilation pipeline
- **Type mapping system**: Converts c-next types (int16, String, etc.) to appropriate C types (int16_t, char*, etc.)

### File Types

- `.cn` files: Regular c-next class/interface files (compiled via `sourceFile` grammar rule)
- `.cnm` files: Main entry files that can contain global functions (compiled via `mainSourceFile` grammar rule)

### Output Generation

Each c-next class generates two C files:
- `.h` header file with declarations and static constants
- `.c` implementation file with function definitions

Functions are prefixed with the class name (e.g., `Math_add` for `add` method in `Math` class).

## Language Features

Key c-next language characteristics to understand when working with the codebase:

- **Assignment operator**: `<-` instead of `=`
- **String literals**: Use backticks `` `string` `` instead of quotes
- **Type system**: Explicit types like `int16`, `int32`, `uint8`, `float32`, `String`
- **Memory management**: Stack allocation by default, explicit heap allocation with interfaces
- **Class structure**: Private members by default, explicit `public` keyword required
- **Pure functions**: All functions are pure with pass-by-value semantics
- **C/C++ Integration**: `#include` headers are parsed for symbol extraction and IntelliSense

## Development Guidelines

### ANTLR Grammar Development
- **Grammar actions**: Remove embedded code actions (JavaScript/Java) from grammar files - they cause TypeScript compilation errors
- **Type safety**: Always check for undefined/null when accessing parser context methods that return optional values
- **Token definitions**: Update both lexer rules AND parser rules when adding new language features

### Code Generation
- **TypeScript compliance**: Generated parser code must compile without errors - avoid mixing JavaScript syntax
- **Method calls**: Parser context methods may return arrays or single values - handle both cases properly
- **Symbol resolution**: Use the SymbolTable to validate function calls and provide type checking

### Testing Arduino Integration
- **Include paths**: Test headers are found in `test-files/` directory structure
- **Symbol extraction**: Verify the CHeaderParser correctly maps C types to c-next types
- **Function calls**: Ensure Arduino constants (LED_BUILTIN) and function calls (pinMode) parse correctly
- **Object instantiation**: Test that `.cnm` files can instantiate classes from `.cn` files