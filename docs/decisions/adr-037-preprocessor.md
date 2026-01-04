# ADR-037: Preprocessor Directive Handling

## Status

**Implemented** — Flag-only defines pass through; value defines and function macros produce errors (E0501, E0502).

## Context

C preprocessor directives are heavily used in embedded development:

- `#include` - Already handled (pass-through)
- `#define` - Constants, macros
- `#ifdef` / `#ifndef` / `#else` / `#endif` - Conditional compilation
- `#pragma` - Compiler hints (future)

C-Next takes a **safety-first approach** based on MISRA C guidelines and common bug patterns.

## Research: Why `#define` Is Dangerous

### MISRA C:2012 Preprocessor Rules (Section 20)

MISRA has 14 rules governing preprocessor usage:

| Rule  | Description                               | Severity |
| ----- | ----------------------------------------- | -------- |
| 20.4  | Macro shall not share name with keyword   | Required |
| 20.5  | `#undef` should not be used               | Advisory |
| 20.7  | Macro parameters must be parenthesized    | Required |
| 20.10 | `#` and `##` operators should not be used | Advisory |

### The 7 Classic `#define` Bugs

1. **Operator Precedence**

   ```c
   #define MULT(a, b) a * b
   MULT(1+2, 3+4)  // Expands to: 1+2 * 3+4 = 11 (not 21!)
   ```

2. **Multiple Evaluation**

   ```c
   #define SQUARE(x) ((x) * (x))
   SQUARE(i++)  // Expands to: ((i++) * (i++)) - increments twice!
   ```

3. **No Type Checking** — Macros bypass the compiler's type system

4. **No Scope** — Macros pollute the global namespace

5. **Swallowing the Semicolon** — Statement macros cause control flow issues

6. **Control Flow Distortion** — Macros with `return` or `break` hide control flow

7. **Debugger Invisible** — Macro values don't exist at runtime

### `const` vs `#define` Comparison

| Aspect      | `#define`              | `const`                |
| ----------- | ---------------------- | ---------------------- |
| Type safety | None                   | Full                   |
| Scope       | Global from definition | Normal C scope         |
| Debugger    | Invisible              | Visible                |
| Memory      | None (text replace)    | Usually optimized away |

Modern compilers (GCC, Clang, arm-gcc) perform constant propagation on `const` variables, making them as efficient as `#define` while maintaining type safety.

## Decision

C-Next enforces a **safety-first preprocessor policy**:

### Allowed

- `#define FLAG` — Flag-only defines for conditional compilation
- `#ifdef` / `#ifndef` / `#else` / `#endif` — Conditional compilation
- `#include` — Already implemented

### Forbidden (Compile Errors)

- `#define NAME value` — **Error E0502**: Must use `const` instead
- `#define NAME(args) ...` — **Error E0501**: Must use inline functions

This eliminates 5 of 7 classic macro bug classes while preserving useful conditional compilation.

### Bug Prevention Analysis

| Bug                         | Solved? | How                         |
| --------------------------- | ------- | --------------------------- |
| 1. Operator Precedence      | ✅      | No value macros allowed     |
| 2. Multiple Evaluation      | ✅      | No function macros allowed  |
| 3. No Type Checking         | ✅      | `const` is type-checked     |
| 4. **No Scope**             | ❌      | `#define FLAG` still global |
| 5. Swallowing the Semicolon | ✅      | No statement macros         |
| 6. Control Flow Distortion  | ✅      | No macro code blocks        |
| 7. **Debugger Invisible**   | ❌      | Flags can't be inspected    |

**Why the 2 unsolved bugs are acceptable:**

**No Scope (#4):** Flag-only defines like `#define ARDUINO` are inherently meant for conditional compilation, which is a global concern. Platform flags need to be visible everywhere `#ifdef` checks them. This isn't a bug—it's the intended use case. If you need scoped constants, use `const` inside a scope.

**Debugger Invisible (#7):** Flags are compile-time constructs used for conditional compilation. They don't exist at runtime because they determine which code is compiled, not runtime values. If you need a debugger-visible value, use `const`. The flag itself (`#define DEBUG`) isn't meant to be inspected—it just controls which code paths exist.

**The key insight:** These two "bugs" only matter for value-bearing macros. For flag-only defines used with `#ifdef`, global visibility is a feature, and runtime invisibility is irrelevant.

## Syntax

### Flag-Only Defines (Allowed)

```cnx
#define ARDUINO
#define STM32F4
#define DEBUG

#ifdef ARDUINO
// Arduino-specific code
#endif

#ifndef DEBUG
// Release mode code
#endif
```

### Value Constants (Required Approach)

```cnx
// ERROR: #define with value
#define BUFFER_SIZE 256  // E0502

// CORRECT: Use const
const u32 BUFFER_SIZE <- 256;
const u8 VERSION[] <- "1.0.0";
```

### Function-Like Macros (Forbidden)

```cnx
// ERROR: Function-like macro
#define MAX(a, b) ((a) > (b) ? (a) : (b))  // E0501

// CORRECT: Use inline function (ADR-031)
inline u32 max(u32 a, u32 b) {
    return (a > b) ? a : b;
}
```

## Error Codes

| Code  | Message                                                                  |
| ----- | ------------------------------------------------------------------------ |
| E0501 | Function-like macro `NAME` is not allowed. Use inline functions instead. |
| E0502 | `#define` with value `NAME` is not allowed. Use `const` instead.         |

## Implementation

### Grammar (CNext.g4)

```antlr
preprocessorDirective
    : defineDirective
    | conditionalDirective
    ;

defineDirective
    : DEFINE_FLAG          // #define PLATFORM
    | DEFINE_WITH_VALUE    // Error: #define SIZE 256
    | DEFINE_FUNCTION      // Error: #define MAX(a,b)
    ;

conditionalDirective
    : IFDEF_DIRECTIVE
    | IFNDEF_DIRECTIVE
    | ELSE_DIRECTIVE
    | ENDIF_DIRECTIVE
    ;
```

### Lexer Tokens

```antlr
DEFINE_FUNCTION   : '#' [ \t]* 'define' [ \t]+ ID [ \t]* '(' ~[\r\n]* ;
DEFINE_WITH_VALUE : '#' [ \t]* 'define' [ \t]+ ID [ \t]+ ~[\r\n]+ ;
DEFINE_FLAG       : '#' [ \t]* 'define' [ \t]+ ID [ \t]* ;
IFDEF_DIRECTIVE   : '#' [ \t]* 'ifdef' [ \t]+ ID [ \t]* ;
IFNDEF_DIRECTIVE  : '#' [ \t]* 'ifndef' [ \t]+ ID [ \t]* ;
ELSE_DIRECTIVE    : '#' [ \t]* 'else' [ \t]* ;
ENDIF_DIRECTIVE   : '#' [ \t]* 'endif' [ \t]* ;
```

### CodeGenerator

- Flag-only defines: Pass through unchanged
- Conditional directives: Pass through unchanged
- Value defines: Throw E0502 error
- Function macros: Throw E0501 error

## Limitations

### Current Implementation

- Preprocessor directives must appear at the top of the file (before declarations)
- Inline conditional compilation (wrapping code blocks) is handled by the C preprocessor after transpilation

### Future Enhancements

- `#pragma` support (ADR-033 for `#pragma pack`)
- Inline conditional blocks in grammar
- `#if` / `#elif` with expressions

## Test Files

Located in `tests/preprocessor/`:

- `flag-define-valid.cnx` — Valid flag-only defines
- `value-define-error.cnx` — E0502 error case
- `function-macro-error.cnx` — E0501 error case
- `conditional-compilation.cnx` — Full conditionals example

## References

- [GCC Macro Pitfalls](https://gcc.gnu.org/onlinedocs/cpp/Macro-Pitfalls.html)
- [When #define Is Considered Harmful - Hackaday](https://hackaday.com/2015/10/16/code-craft-when-define-is-considered-harmful/)
- [Common C Preprocessor Mistakes - Atomic Object](https://spin.atomicobject.com/2012/03/30/preprocessing-with-caution/)
- [MISRA C:2012 Guidelines](https://electrovolt.ir/wp-content/uploads/2022/09/MISRA-C_2012_-Guidelines-for-the-Use-of-the-C-Language-in-Critical-Systems-Motor-Industry-Research-Association-2013-2013.pdf)
