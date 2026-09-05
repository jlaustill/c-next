# C-Next Error Code Registry

This document is the authoritative registry of all C-Next compiler error codes. When adding new error codes, assign the next available code in the appropriate range and update this document.

A row marked _(reserved)_ names a code that is spoken for but not yet implemented. It is
listed because "next available" is read from this table: a code reserved elsewhere and
recorded nowhere gets assigned a second time, and the collision is silent — the registry
is hand-maintained and has no gate, while `npm run diagnostics:manifest:check` only sees
codes that already have a fixture.

## Error Code Ranges

| Range     | Category                | Count  |
| --------- | ----------------------- | ------ |
| E00xx     | Reserved/Test           | 1      |
| E02xx     | Identifier/Param Naming | 5      |
| E03xx     | Struct Fields           | 2      |
| E04xx     | Symbol Resolution       | 9      |
| E05xx     | Include/Preprocessor    | 7      |
| E06xx     | Sizeof Expressions      | 2      |
| E07xx     | Control Flow            | 7      |
| E08xx     | Arithmetic/Array Safety | 16     |
| E09xx     | NULL Safety             | 8      |
| **Total** |                         | **57** |

---

## E00xx — Reserved/Test

| Code  | Message            | Source                                                      |
| ----- | ------------------ | ----------------------------------------------------------- |
| E0000 | Generic test error | `logic/analysis/types/__tests__/IBaseAnalysisError.test.ts` |

---

## E02xx — Identifier and Parameter Naming

| Code  | Message                                                                      | Help                                                              | Source                                          |
| ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| E0201 | Identifier ends with, or contains consecutive, underscores                   | Remove the trailing underscore, or collapse `__` to `_`           | `logic/analysis/IdentifierSyntaxAnalyzer.ts`    |
| E0202 | Identifier begins with the reserved prefix `cnx_`                            | Drop the reserved prefix                                          | `logic/analysis/IdentifierSyntaxAnalyzer.ts`    |
| E0203 | Two source files produce the same include guard                              | Rename one so the generated headers stay distinguishable          | `Transpiler.ts`                                 |
| E0204 | External identifiers not distinct within the target's significant characters | Shorten the scope name or the member names                        | `Transpiler.ts`, `logic/symbols/SymbolTable.ts` |
| E0227 | Parameter cannot start with function name prefix                             | Consider renaming to a name that doesn't start with function name | `logic/analysis/ParameterNamingAnalyzer.ts`     |

**Related:** ADR-063 and Issue #1117 (E0201); ADR-063 and Issues #1131/#1132 (E0202);
ADR-063 and Issues #1133/#1134 (E0203); ADR-063 and Issue #1307 (E0204); Issue #227 (E0227)

E0201 reserves `__` as the qualified-name separator so that `Scope__member` cannot
collide with a plain identifier. A **leading** underscore is legal — injectivity
constrains only the separator's left boundary. Checked on declarations only, so
references to C/C++ header symbols such as `__disable_irq()` are unaffected.

E0202 reserves the `cnx_` prefix, compared case-insensitively, for names the
transpiler generates — `cnx_tmp<N>`, `cnx_len_<var>`, `cnx_clamp_<op>_<type>` and
the `CNX_<PATH>_H` include guard. It is a different guarantee from E0201: `__`
says which components built a qualified name, while `cnx_` keeps the transpiler's
namespace and the user's disjoint. Prefix-only, so `my_cnx_buffer` is legal, and
declarations-only, so calling an external C symbol named `cnx_foo()` is fine.

E0204 is the same injectivity question asked against a **budget** rather than
against the whole string. E0201 makes the `Scope__member` join injective; C99
§5.2.4.1 then guarantees only 31 significant initial characters in an external
identifier, so a join that is injective can still land on one identifier once the
target truncates it. The `__` separator costs two characters per level and the
scope name costs its full length, so the budget is consumed by the encoding, not
by the author's naming (#1307). Reported against
`ITargetCapabilities.significantExternalIdentifierChars`, not a hardcoded 31 —
the limit belongs to the C target. Because Rule 5.1 is a whole-program property,
the budget is resolved once per run rather than per file: an explicit `--target`
names one target for every translation unit and wins outright; otherwise the
narrowest budget among the files' `#pragma target` declarations applies, since a
pair that collides for the strictest target in a build collides in that build. Scoped to identifiers C-Next generates with
external linkage: `private` members are `static` and get the 63-character
internal budget (#1338), types have no linkage, and a C/C++ header's identifiers
are not C-Next's to rename. The message names `cnxScopedName` rather than the
generated identifier, per #1292.

E0203 fires when two files in one compilation map to the same include guard.
Guards are built from the project-relative path, and conversion to upper case
is lossy, so
`mod-a.cnx` and `mod_a.cnx` collide, as do filenames differing only by case.
ADR-063 diagnoses that residue rather than hashing or escape-encoding the path,
which would trade away the readability of the generated artifact. The requirement
is only that it is never silent: before this check the preprocessor skipped the
second header and the program ran with a wrong value.

---

## E03xx — Struct Fields

| Code  | Message                                    | Help                                                            | Source                                  |
| ----- | ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| E0355 | Struct field uses a reserved property name | Reserved names (e.g., `.length`). Use 'len', 'size', or 'count' | `logic/analysis/StructFieldAnalyzer.ts` |

---

## E04xx — Symbol Resolution / Initialization

| Code  | Message                                                 | Help                                                                                                                                                             | Source                                                                             |
| ----- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| E0381 | Use of possibly/uninitialized variable                  | Variable must be initialized before use                                                                                                                          | `logic/analysis/InitializationAnalyzer.ts`                                         |
| E0422 | Function called before definition                       | Define function before calling it                                                                                                                                | `logic/analysis/FunctionCallAnalyzer.ts`                                           |
| E0423 | Recursive function call (MISRA C:2012 Rule 17.2)        | Remove recursive call                                                                                                                                            | `logic/analysis/FunctionCallAnalyzer.ts`                                           |
| E0424 | Unqualified enum member — did you mean `Enum.member`?   | Use qualified enum member syntax                                                                                                                                 | `output/codegen/CodeGenerator.ts`, `SwitchGenerator.ts`, `ControlFlowGenerator.ts` |
| E0425 | Symbol defined multiple times, or in multiple languages | Rename one definition                                                                                                                                            | `logic/symbols/SymbolTable.ts`, `Transpiler.ts`                                    |
| E0426 | Type is not defined                                     | Declare the type, or #include the file that does                                                                                                                 | `logic/analysis/UndeclaredTypeAnalyzer.ts`                                         |
| E0427 | Identifier is not defined                               | Declare it, or #include the file that does                                                                                                                       | `logic/analysis/UndeclaredValueAnalyzer.ts`                                        |
| E0428 | _(reserved)_ — cannot assign integer to enum            | Not yet implemented. Reserved by the #1321 throw audit (`docs/architecture/output-throw-classification.md`) so it is not assigned twice; #1380 tracks this drift | `output/codegen/helpers/EnumAssignmentValidator.ts`                                |
| E0429 | Name is a register, not a type                          | Access the register's members instead, e.g. `GPIO.DR`                                                                                                            | `logic/analysis/UndeclaredTypeAnalyzer.ts`                                         |
| E0430 | Nested scopes are not allowed                           | Use a flat scope such as `Hardware_GPIO`                                                                                                                         | `logic/parser/CNextSourceParser.ts`                                                |

**Related:** ADR-030 (E0422), ADR-016 (E0425 — a reopened scope composes, but its
members stay unique)

**E0429 (#1336)** is the type position's other answer: the name IS declared, as a
register, and a register is not a type. ADR-004 makes a register a binding to memory,
not a type name, so `Control c;` had no type behind it and the transpiler emitted C the
compiler rejects at exit 0. Reporting E0426 ("not defined") for a register declared a
few lines up would describe the transpiler rather than the source, which is why this is
its own code rather than a second message on E0426.

ADR-111 would make a register name a type. It is `Research`, and its own header states
that while it is Research "a register is still not a type", so ADR-004 governs and this
diagnostic is correct today. **When ADR-111 is implemented, E0429 is retired outright** —
`Control c(0x40000000)` becomes the instantiation form that ADR designs. Grep `ADR-111`
to find every site that has to change together.

**E0426/E0427 (#1312, #1353, #1398)** complete the set: an undeclared name is diagnosed
in a type position, a value position and a call position (E0422) rather than only the
last. Both are reported only where the transpiler knows the file's whole name universe —
a file including an unparsed C/C++ header keeps the previous permissive behavior, because
rejecting a type the compiler will supply is a regression while failing to diagnose is
the status quo.

Both also answer per FILE, not per run (#1398). A value declared in a sibling this file
never included is undefined here, exactly as a type is — the value check reads the
include-filtered name set rather than the run-wide symbol table, which answers "declared
anywhere in this run" and so could never reject a sibling reference. E0426 had a per-file
view from the start and E0427 did not, which is why the type case was diagnosed and the
identical value case compiled to C that gcc rejects. What remains permissive is the
foreign-header case above: no edge connects a `.cnx` to the headers it includes, so
include-visibility is not derivable for a C or C++ name.

---

## E05xx — Include/Preprocessor

| Code  | Message                                          | Help                                                                                                                                    | Source                                                  |
| ----- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| E0501 | Function-like macro not allowed                  | Use inline functions instead                                                                                                            | `output/codegen/generators/support/IncludeGenerator.ts` |
| E0502 | `#define` with value not allowed                 | Use `const u32 NAME <- value;` instead                                                                                                  | `output/codegen/generators/support/IncludeGenerator.ts` |
| E0503 | Cannot `#include` implementation file            | Only `.h` and `.hpp` files are allowed                                                                                                  | `output/codegen/TypeValidator.ts`                       |
| E0504 | `.cnx` alternative exists for included header    | Use `#include "file.cnx"` for the C-Next version                                                                                        | `output/codegen/TypeValidator.ts`                       |
| E0505 | Header names a pointer typedef it cannot declare | Include the header that defines the type; a forward declaration cannot express a pointer typedef                                        | `output/headers/BaseHeaderGenerator.ts`                 |
| E0506 | _(reserved)_ — included C-Next file not found    | Not yet implemented. Reserved by the #1321 throw audit (`docs/architecture/output-throw-classification.md`) so it is not assigned twice | `output/codegen/generators/support/IncludeGenerator.ts` |
| E0507 | C++ header in a run that does not target C++     | Set `cppRequired: true` in the config, or pass `--cpp`                                                                                  | `Transpiler.ts`                                         |

---

## E06xx — Sizeof Expressions (ADR-023)

| Code  | Message                                            | Help                                                                        | Source                                        |
| ----- | -------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| E0601 | `sizeof()` on array parameter returns pointer size | Use `varName.length` for count or `sizeof(type) * varName.length` for bytes | `output/codegen/resolution/SizeofResolver.ts` |
| E0602 | `sizeof()` operand must not have side effects      | Remove side effects (MISRA C:2012 Rule 13.6)                                | `output/codegen/resolution/SizeofResolver.ts` |

---

## E07xx — Control Flow Validation

| Code  | Message                                                             | Help                                                                          | Source                                                         |
| ----- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| E0701 | Condition must be a boolean expression                              | Use explicit comparison: `expr > 0` or `expr != 0`                            | `output/codegen/TypeValidator.ts`                              |
| E0702 | Function call in condition not allowed                              | Store function result in a variable first                                     | `output/codegen/TypeValidator.ts`, `ControlFlowGenerator.ts`   |
| E0703 | `break`/`continue` not supported                                    | Use structured conditions instead                                             | `output/codegen/CodeGenerator.ts`                              |
| E0704 | Non-void function must return on all paths                          | Add an explicit `return <value>;` so every path returns a value               | `logic/analysis/ReturnPathAnalyzer.ts`                         |
| E0705 | `forever` loop in non-void function                                 | Make the function return `void`, or use a `while` loop with an exit condition | `output/codegen/generators/statements/ControlFlowGenerator.ts` |
| E0707 | Disguised infinite loop (`for(;;)` / always-true literal condition) | Write `forever { ... }` for an intentional infinite loop                      | `output/codegen/TypeValidator.ts`, `ControlFlowGenerator.ts`   |
| E0708 | Return value of non-void function discarded                         | Use the value, or discard it explicitly: `(void) f(...);`                     | `logic/analysis/ReturnValueUseAnalyzer.ts`                     |

**Related:** MISRA C:2012 Rule 14.4 (E0701), Rule 13.5 / Issue #254 (E0702), ADR-026 / Issue #1011 (E0703), ADR-067 / Issue #1040 (E0704), ADR-068 / Issue #1074 (E0705), ADR-068 / Issue #1075 (E0707; E0706 reserved for ADR-069 unreachable code; ADR-070 / Issue #847 (E0708); E0709 reserved for ADR-069 unused variable / Issue #1107)

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

### Essential Type Safety (MISRA C:2012)

| Code  | Message                                                                                                | Help                                                                                         | Source                                        |
| ----- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| E0805 | Shift operator used on a signed integer type (MISRA C:2012 Rule 10.1)                                  | Shift an unsigned value; signed shifts are UB / implementation-defined in C                  | `logic/analysis/SignedShiftAnalyzer.ts`       |
| E0806 | Compound assignment used on a `bool` (MISRA C:2012 Rule 10.1)                                          | Only `<-` is valid on a bool; flip a flag with `flag <- !flag`                               | `logic/analysis/BooleanOperandAnalyzer.ts`    |
| E0807 | Arithmetic, bitwise, shift or relational operator applied to a `bool` operand (MISRA C:2012 Rule 10.1) | A bool is not a number; combine flags with `&&` / `\|\|` / `!`, compare them with `=` / `!=` | `logic/analysis/BooleanOperandAnalyzer.ts`    |
| E0810 | Binary operator combines operands of different essential type categories (Rule 10.4)                   | Reinterpret one operand's bits to match the other with bit indexing, e.g. `value[0, 32]`     | `logic/analysis/MixedTypeCategoryAnalyzer.ts` |

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

### Subscript Depth (ADR-036 / ADR-007)

| Code  | Message                       | Help                                                                                     | Source                                    |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| E0856 | Too many subscripts on a base | A base allows `arrayDimensions + 1` subscripts; for a bit field use `name[start, width]` | `output/codegen/helpers/CodeGenErrors.ts` |

Each subscript peels one array dimension (ADR-036) and a scalar integer/float may be
bit-indexed once (ADR-007), so `flags[4][3]` on a scalar `u8` indexes the single bit
`flags[4]` — a value that is not an array. Raised for every ADR-016 spelling of the
base: bare, `this.` and `global.`.

---

## E09xx — NULL Safety (ADR-046)

| Code  | Message                                                | Help                                                      | Source                                |
| ----- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------- |
| E0901 | C library function can return NULL — must check result | Use: `if (func(...) != NULL) { ... }`                     | `logic/analysis/NullCheckAnalyzer.ts` |
| E0902 | Importing a dynamic memory function from C/C++         | Keep it in your C or C++ code (ADR-003)                   | `logic/analysis/DynamicAllocation.ts` |
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
