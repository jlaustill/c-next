# ADR-037: Preprocessor Directive Handling

## Status
**Research**

## Context

C preprocessor directives are heavily used:
- `#include` - Already handled (pass-through)
- `#define` - Constants, macros
- `#ifdef` / `#ifndef` - Conditional compilation
- `#pragma` - Compiler hints

C-Next currently passes `#include` through. What about others?

## Decision Drivers

1. **C Compatibility** - Existing C headers use defines
2. **Conditional Compilation** - Platform-specific code
3. **Simplicity** - Don't reinvent the preprocessor
4. **Safety** - Macros can be dangerous

## Options Considered

### Option A: Pass All Through
```cnx
#define BUFFER_SIZE 256
#ifdef DEBUG
    log("debug");
#endif
```

**Pros:** Full C compatibility
**Cons:** No validation, macros bypass type system

### Option B: Validate and Pass Through
Parse directives, validate, then generate:
- Check `#define` syntax
- Track conditional blocks
- Warn on dangerous patterns

**Pros:** Some safety
**Cons:** Complex, still not type-safe

### Option C: Replace with C-Next Features
- `#define CONST 5` → `const u32 CONST <- 5;`
- `#ifdef` → build-time configuration system

**Pros:** Type-safe, cleaner
**Cons:** Can't use existing C headers

### Option D: Selective Handling
- `#include` - Pass through (current)
- `#define` constants - Parse, validate, pass through
- `#define` macros - Warning, pass through
- `#ifdef` - Pass through

**Pros:** Balance of safety and compatibility
**Cons:** Complex rules

## Recommended Decision

**Option D: Selective Handling** for maximum C compatibility with safety hints.

## Syntax

### Include (Already Implemented)
```cnx
#include <stdint.h>
#include "config.h"
```

### Simple Defines
```cnx
#define BUFFER_SIZE 256
#define VERSION "1.0.0"

// Better: use const
const u32 BUFFER_SIZE <- 256;
const u8 VERSION[] <- "1.0.0";
```

### Conditional Compilation
```cnx
#ifdef STM32F4
    register GPIO @ 0x40020000 { ... }
#endif

#ifdef ARDUINO
    #include <Arduino.h>
#endif

#ifndef NDEBUG
    void assert(bool condition) { ... }
#endif
```

### Function-like Macros (Warning)
```cnx
#define MAX(a, b) ((a) > (b) ? (a) : (b))  // Warning: prefer inline function

// Better:
inline u32 max(u32 a, u32 b) {
    return (a > b) ? a : b;
}
```

### Pragma
```cnx
#pragma once           // Header guard alternative
#pragma pack(push, 1)  // Packing (prefer @packed attribute)
```

## Implementation Notes

### Grammar Changes
```antlr
preprocessorDirective
    : DEFINE_DIRECTIVE
    | IFDEF_DIRECTIVE
    | IFNDEF_DIRECTIVE
    | ELSE_DIRECTIVE
    | ENDIF_DIRECTIVE
    | PRAGMA_DIRECTIVE
    ;

DEFINE_DIRECTIVE
    : '#' [ \t]* 'define' ~[\r\n]*
    ;

// Similar for others...
```

### Validation
- Warn on function-like macros
- Suggest const for simple defines
- Track ifdef nesting

### CodeGenerator
Pass through verbatim to generated C.

### Priority
**High** - Required for platform-specific code and C header compat.

## Open Questions

1. Parse defines deeply or just pass through?
2. Custom build configuration system?
3. Macro expansion validation?

## References

- C preprocessor
- MISRA C preprocessor rules
- Rust cfg attributes (alternative approach)
