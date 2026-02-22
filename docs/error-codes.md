# C-Next Error Code Registry

This document is the authoritative registry of all C-Next compiler error codes. When adding new error codes, assign the next available code in the appropriate range and update this document.

## Error Code Ranges

| Range     | Category                | Count  |
| --------- | ----------------------- | ------ |
| E00xx     | Reserved/Test           | 1      |
| E02xx     | Parameter Naming        | 1      |
| E03xx     | Struct Fields           | 1      |
| E04xx     | Symbol Resolution       | 3      |
| E05xx     | Include/Preprocessor    | 4      |
| E06xx     | Sizeof Expressions      | 2      |
| E07xx     | Control Flow            | 2      |
| E08xx     | Arithmetic/Array Safety | 9      |
| E09xx     | NULL Safety             | 8      |
| **Total** |                         | **31** |

---

## E00xx — Reserved/Test

| Code  | Message            | Source                                                      |
| ----- | ------------------ | ----------------------------------------------------------- |
| E0000 | Generic test error | `logic/analysis/types/__tests__/IBaseAnalysisError.test.ts` |

---

## E02xx — Parameter Naming

| Code  | Message                                          | Help                                                              | Source                                      |
| ----- | ------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------- |
| E0227 | Parameter cannot start with function name prefix | Consider renaming to a name that doesn't start with function name | `logic/analysis/ParameterNamingAnalyzer.ts` |

**Related:** Issue #227

---

## E03xx — Struct Fields

| Code  | Message                                    | Help                                                            | Source                                  |
| ----- | ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| E0355 | Struct field uses a reserved property name | Reserved names (e.g., `.length`). Use 'len', 'size', or 'count' | `logic/analysis/StructFieldAnalyzer.ts` |

---

## E04xx — Symbol Resolution / Initialization

| Code  | Message                                               | Help                                    | Source                                                                             |
| ----- | ----------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| E0381 | Use of possibly/uninitialized variable                | Variable must be initialized before use | `logic/analysis/InitializationAnalyzer.ts`                                         |
| E0422 | Function called before definition                     | Define function before calling it       | `logic/analysis/FunctionCallAnalyzer.ts`                                           |
| E0423 | Recursive function call (MISRA C:2012 Rule 17.2)      | Remove recursive call                   | `logic/analysis/FunctionCallAnalyzer.ts`                                           |
| E0424 | Unqualified enum member — did you mean `Enum.member`? | Use qualified enum member syntax        | `output/codegen/CodeGenerator.ts`, `SwitchGenerator.ts`, `ControlFlowGenerator.ts` |

**Related:** ADR-030 (E0422)

---

## E05xx — Include/Preprocessor

| Code  | Message                                       | Help                                             | Source                                                  |
| ----- | --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| E0501 | Function-like macro not allowed               | Use inline functions instead                     | `output/codegen/generators/support/IncludeGenerator.ts` |
| E0502 | `#define` with value not allowed              | Use `const u32 NAME <- value;` instead           | `output/codegen/generators/support/IncludeGenerator.ts` |
| E0503 | Cannot `#include` implementation file         | Only `.h` and `.hpp` files are allowed           | `output/codegen/TypeValidator.ts`                       |
| E0504 | `.cnx` alternative exists for included header | Use `#include "file.cnx"` for the C-Next version | `output/codegen/TypeValidator.ts`                       |

---

## E06xx — Sizeof Expressions (ADR-023)

| Code  | Message                                            | Help                                                                        | Source                                        |
| ----- | -------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| E0601 | `sizeof()` on array parameter returns pointer size | Use `varName.length` for count or `sizeof(type) * varName.length` for bytes | `output/codegen/resolution/SizeofResolver.ts` |
| E0602 | `sizeof()` operand must not have side effects      | Remove side effects (MISRA C:2012 Rule 13.6)                                | `output/codegen/resolution/SizeofResolver.ts` |

---

## E07xx — Control Flow Validation

| Code  | Message                                | Help                                               | Source                                                       |
| ----- | -------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| E0701 | Condition must be a boolean expression | Use explicit comparison: `expr > 0` or `expr != 0` | `output/codegen/TypeValidator.ts`                            |
| E0702 | Function call in condition not allowed | Store function result in a variable first          | `output/codegen/TypeValidator.ts`, `ControlFlowGenerator.ts` |

**Related:** MISRA C:2012 Rule 14.4 (E0701), Rule 13.5 / Issue #254 (E0702)

---

## E08xx — Arithmetic and Array Safety

### Division/Modulo (ADR-051)

| Code  | Message                             | Help                                                     | Source                                      |
| ----- | ----------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| E0800 | Division by zero (literal)          | Use `safe_div(output, numerator, divisor, defaultValue)` | `logic/analysis/DivisionByZeroAnalyzer.ts`  |
| E0801 | Division by zero (const expression) | Use `safe_div()` for runtime safety                      | Reserved in `types/IDivisionByZeroError.ts` |
| E0802 | Modulo by zero (literal)            | Use `safe_mod(output, numerator, divisor, defaultValue)` | `logic/analysis/DivisionByZeroAnalyzer.ts`  |
| E0803 | Modulo by zero (const expression)   | Use `safe_mod()` for runtime safety                      | Reserved in `types/IDivisionByZeroError.ts` |
| E0804 | Modulo with floating-point type     | Use `fmod()` from `<math.h>`                             | `logic/analysis/FloatModuloAnalyzer.ts`     |

### Array Index Type Safety

| Code  | Message                                  | Help                                              | Source                                     |
| ----- | ---------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| E0850 | Signed integer used as subscript index   | Use unsigned integer type for array/bit subscript | `logic/analysis/ArrayIndexTypeAnalyzer.ts` |
| E0851 | Floating-point used as subscript index   | Use unsigned integer type for array/bit subscript | `logic/analysis/ArrayIndexTypeAnalyzer.ts` |
| E0852 | Non-integer type used as subscript index | Use unsigned integer type for array/bit subscript | `logic/analysis/ArrayIndexTypeAnalyzer.ts` |

### Critical Section Safety

| Code  | Message                                     | Help                                              | Source                            |
| ----- | ------------------------------------------- | ------------------------------------------------- | --------------------------------- |
| E0853 | Cannot use `return` inside critical section | Would leave interrupts disabled; restructure flow | `output/codegen/TypeValidator.ts` |

### Array Index Overflow (ADR-054) — Reserved

| Code  | Message                                            | Help                                                    | Source  |
| ----- | -------------------------------------------------- | ------------------------------------------------------- | ------- |
| E0854 | Compile-time warning: constant index out of bounds | Fix the index; the safety net should not be relied upon | Planned |
| E0855 | Invalid overflow modifier in array dimension       | Use `clamp`, `wrap`, or `discard`                       | Planned |

---

## E09xx — NULL Safety (ADR-046)

| Code  | Message                                                | Help                                                      | Source                                |
| ----- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------- |
| E0901 | C library function can return NULL — must check result | Use: `if (func(...) != NULL) { ... }`                     | `logic/analysis/NullCheckAnalyzer.ts` |
| E0902 | Dynamic allocation function forbidden                  | Dynamic allocation is forbidden (ADR-003)                 | `logic/analysis/NullCheckAnalyzer.ts` |
| E0903 | NULL can only be used in comparison context            | Use: `if (func(...) != NULL)` or `== NULL`                | `logic/analysis/NullCheckAnalyzer.ts` |
| E0904 | Cannot store C function pointer return in variable     | Use direct comparison: `if (func(...) != NULL)`           | `logic/analysis/NullCheckAnalyzer.ts` |
| E0905 | Missing `c_` prefix for nullable C type                | Use: `TypeName c_varName <- func(...)`                    | `logic/analysis/NullCheckAnalyzer.ts` |
| E0906 | Invalid `c_` prefix on non-nullable type               | Remove `c_` — only for nullable C pointer types           | `logic/analysis/NullCheckAnalyzer.ts` |
| E0907 | NULL comparison on non-nullable variable               | Only `c_` variables can be compared to NULL               | `logic/analysis/NullCheckAnalyzer.ts` |
| E0908 | Nullable variable used without NULL check              | Check for NULL before use: `if (varName != NULL) { ... }` | `logic/analysis/NullCheckAnalyzer.ts` |

---

## Adding New Error Codes

1. Choose the next available code in the appropriate range
2. Add the error to the source file with format: `E0XXX: message`
3. Update this document with the new code, message, help text, and source
4. If starting a new range, add a new section

**Source paths are relative to `src/transpiler/`.**
