# MISRA C:2012 Compliance in C-Next

This document tracks C-Next's compliance with MISRA C:2012 guidelines. MISRA C is a set of software development guidelines for the C programming language, widely used in safety-critical embedded systems.

## Status Legend

| Status           | Meaning                                    |
| ---------------- | ------------------------------------------ |
| **Enforced**     | Compiler produces an error if violated     |
| **By Design**    | Language design makes violation impossible |
| **Partial**      | Some cases enforced, others not yet        |
| **Planned**      | On roadmap for future implementation       |
| **N/A**          | Rule not applicable to C-Next              |
| **Not Enforced** | Currently not checked                      |

## Summary

| Category         | Enforced | By Design | Partial | N/A | Not Enforced |
| ---------------- | -------- | --------- | ------- | --- | ------------ |
| Directives (1-4) | 0        | 2         | 0       | 2   | 0            |
| Rules 1-5        | 3        | 5         | 1       | 8   | 6            |
| Rules 6-10       | 2        | 3         | 2       | 5   | 8            |
| Rules 11-15      | 1        | 12        | 1       | 8   | 5            |
| Rules 16-22      | 4        | 8         | 2       | 12  | 6            |

---

## Directives

### Dir 1 - Implementation Compliance

| Rule    | Description                                         | Status | Reference                       |
| ------- | --------------------------------------------------- | ------ | ------------------------------- |
| Dir 1.1 | Implementation-defined behavior shall be documented | N/A    | C-Next transpiles to standard C |

### Dir 2 - Compilation Units

| Rule    | Description                                   | Status        | Reference                          |
| ------- | --------------------------------------------- | ------------- | ---------------------------------- |
| Dir 2.1 | All source files shall compile without errors | **By Design** | Transpiler validates before output |

### Dir 3 - Run-time Failures

| Rule    | Description                        | Status        | Reference                          |
| ------- | ---------------------------------- | ------------- | ---------------------------------- |
| Dir 3.1 | Run-time errors shall be minimized | **By Design** | Static allocation, bounds checking |

### Dir 4 - Code Design

| Rule     | Description                                  | Status        | Reference                          |
| -------- | -------------------------------------------- | ------------- | ---------------------------------- |
| Dir 4.1  | Run-time failures shall be minimized         | **By Design** | No dynamic allocation, type safety |
| Dir 4.3  | Assembly shall be encapsulated               | N/A           | No inline assembly in C-Next       |
| Dir 4.6  | typedefs for basic types should be used      | **By Design** | Fixed-width types (u8, i32, etc.)  |
| Dir 4.7  | Check return values of error-prone functions | **Enforced**  | E0901: NULL check required         |
| Dir 4.8  | Pointer members should be hidden             | **By Design** | No raw pointers                    |
| Dir 4.9  | Function-like macros should be avoided       | **By Design** | No preprocessor macros             |
| Dir 4.10 | Precautions against multiple inclusion       | **By Design** | Module system handles this         |
| Dir 4.11 | Check validity of function parameters        | Partial       | Some validation, not comprehensive |
| Dir 4.12 | Dynamic memory shall not be used             | **By Design** | ADR-003: Static allocation only    |
| Dir 4.13 | Resource lifetime management                 | **By Design** | No dynamic resources               |

---

## Rule 1 - Standard C Environment

| Rule | Description                                | Status        | Reference                      |
| ---- | ------------------------------------------ | ------------- | ------------------------------ |
| 1.1  | Conform to C90/C99/C11                     | **By Design** | Generates C99-compliant code   |
| 1.2  | Language extensions usage                  | N/A           | No extensions used             |
| 1.3  | No undefined/critical unspecified behavior | Partial       | Many cases prevented by design |

---

## Rule 2 - Unused Code

| Rule | Description                  | Status       | Reference                     |
| ---- | ---------------------------- | ------------ | ----------------------------- |
| 2.1  | Unreachable code             | Not Enforced | Could add dead code detection |
| 2.2  | No dead code                 | Not Enforced | Could add dead code detection |
| 2.3  | Unused type declarations     | Not Enforced |                               |
| 2.4  | Unused tag declarations      | Not Enforced |                               |
| 2.5  | Unused macro declarations    | N/A          | No macros in C-Next           |
| 2.6  | Unused function declarations | Not Enforced |                               |
| 2.7  | Unused function parameters   | Not Enforced |                               |

---

## Rule 3 - Comments

| Rule | Description                 | Status       | Reference                |
| ---- | --------------------------- | ------------ | ------------------------ |
| 3.1  | No nested /\* \*/ comments  | **Enforced** | ADR-043, test: misra-3-1 |
| 3.2  | No // or /\* in line splice | **Enforced** | ADR-043, test: misra-3-2 |

---

## Rule 4 - Character Sets

| Rule | Description                           | Status        | Reference                 |
| ---- | ------------------------------------- | ------------- | ------------------------- |
| 4.1  | Octal/hex escape sequences terminated | **By Design** | String literals validated |
| 4.2  | Trigraphs shall not be used           | **By Design** | Not supported in grammar  |

---

## Rule 5 - Identifiers

| Rule | Description                              | Status        | Reference                 |
| ---- | ---------------------------------------- | ------------- | ------------------------- |
| 5.1  | External identifiers distinct (31 chars) | **By Design** | Generated C uses prefixes |
| 5.2  | Identifiers in same scope distinct       | **By Design** | Scope prefixing           |
| 5.3  | Identifier in inner scope no hide        | Partial       | Some shadowing detection  |
| 5.4  | Macro identifiers distinct               | N/A           | No macros                 |
| 5.5  | Identifiers distinct from macros         | N/A           | No macros                 |
| 5.6  | Unique typedef names                     | **By Design** | Type system enforces      |
| 5.7  | Unique tag names                         | **By Design** | Type system enforces      |
| 5.8  | Unique external identifiers              | **By Design** | Scope prefixing (ADR-016) |
| 5.9  | Unique internal identifiers              | Not Enforced  |                           |

---

## Rule 6 - Types

| Rule | Description                          | Status        | Reference                        |
| ---- | ------------------------------------ | ------------- | -------------------------------- |
| 6.1  | Bit-fields only on appropriate types | **By Design** | ADR-007: Type-aware bit indexing |
| 6.2  | Single-bit fields not signed         | **By Design** | Bit operations validated         |

---

## Rule 7 - Literals and Constants

| Rule | Description                    | Status        | Reference                     |
| ---- | ------------------------------ | ------------- | ----------------------------- |
| 7.1  | No octal constants             | Not Enforced  | Could add detection           |
| 7.2  | U suffix on unsigned constants | **By Design** | Type suffixes generated       |
| 7.3  | Lowercase L not used in suffix | **By Design** | Generated code uses uppercase |
| 7.4  | String literal not modified    | **By Design** | Strings are immutable         |

---

## Rule 8 - Declarations and Definitions

| Rule | Description                                     | Status        | Reference                          |
| ---- | ----------------------------------------------- | ------------- | ---------------------------------- |
| 8.1  | Types explicitly stated                         | **By Design** | No implicit types                  |
| 8.2  | Function types with prototypes                  | **By Design** | All functions have prototypes      |
| 8.3  | Compatible declarations                         | **By Design** | Single definition rule             |
| 8.4  | Compatible external declarations                | **By Design** | Module system                      |
| 8.5  | External object/function one definition         | **By Design** | Issue #852: extern only in headers |
| 8.6  | Identifier with external linkage one definition | **By Design** |                                    |
| 8.7  | Functions/objects internal if possible          | Not Enforced  |                                    |
| 8.8  | Static for internal linkage                     | Partial       | ADR-038: static/extern             |
| 8.9  | Object at block scope if possible               | Not Enforced  |                                    |
| 8.10 | Inline functions internal linkage               | **By Design** | ADR-031                            |
| 8.11 | Array size explicit when extern                 | Partial       |                                    |
| 8.12 | Enum implicit values only if all implicit       | Not Enforced  |                                    |
| 8.13 | Pointer to const if not modified                | Not Enforced  |                                    |
| 8.14 | No restrict qualifier                           | **By Design** | Not in C-Next                      |

---

## Rule 9 - Initialization

| Rule | Description                           | Status        | Reference                    |
| ---- | ------------------------------------- | ------------- | ---------------------------- |
| 9.1  | Auto variables initialized before use | Partial       | Some initialization tracking |
| 9.2  | Initializers in braces                | **By Design** | ADR-035: Array initializers  |
| 9.3  | No partial array initialization       | **Enforced**  | ADR-035                      |
| 9.4  | Element initialized once              | **By Design** | No designated initializers   |
| 9.5  | Array size matches initializer        | **Enforced**  | Array bounds validated       |

---

## Rule 10 - Essential Type Model

| Rule | Description                            | Status       | Reference                |
| ---- | -------------------------------------- | ------------ | ------------------------ |
| 10.1 | Operands of appropriate essential type | Partial      | Type validation exists   |
| 10.2 | Expressions of appropriate type        | Partial      |                          |
| 10.3 | No narrowing without cast              | Partial      | E0403: Integer narrowing |
| 10.4 | Arithmetic on same essential type      | Not Enforced |                          |
| 10.5 | No inappropriate cast                  | Partial      | ADR-024: Type casting    |
| 10.6 | Composite assigned to wider type       | Not Enforced |                          |
| 10.7 | Composite expressions type             | Not Enforced |                          |
| 10.8 | Composite cast to wider type           | Not Enforced |                          |

---

## Rule 11 - Pointer Type Conversions

| Rule | Description                            | Status        | Reference                   |
| ---- | -------------------------------------- | ------------- | --------------------------- |
| 11.1 | No function pointer conversion         | **By Design** | No raw pointers             |
| 11.2 | No incomplete type pointer conversion  | **By Design** | No raw pointers             |
| 11.3 | No pointer/integer conversion          | **By Design** | No raw pointers             |
| 11.4 | No conversion to pointer to object     | **By Design** | No raw pointers             |
| 11.5 | No void\* to object pointer            | **By Design** | No void pointers            |
| 11.6 | No pointer to void to arithmetic       | **By Design** | No void pointers            |
| 11.7 | No cast between pointer and arithmetic | **By Design** | No raw pointers             |
| 11.8 | No cast removing const/volatile        | **By Design** | ADR-013: const enforced     |
| 11.9 | NULL for null pointer constant         | **By Design** | NULL handling in transpiler |

---

## Rule 12 - Expressions

| Rule | Description                          | Status        | Reference              |
| ---- | ------------------------------------ | ------------- | ---------------------- |
| 12.1 | Explicit precedence with parentheses | Not Enforced  | Could add warning      |
| 12.2 | Shift not exceeding bit width        | **Enforced**  | Shift validation       |
| 12.3 | No comma operator                    | **By Design** | Not in grammar         |
| 12.4 | Constant expressions evaluable       | Partial       | Some compile-time eval |
| 12.5 | sizeof not on array parameters       | N/A           | No array decay         |

---

## Rule 13 - Side Effects

| Rule | Description                             | Status        | Reference                 |
| ---- | --------------------------------------- | ------------- | ------------------------- |
| 13.1 | Initializer lists no side effects       | Not Enforced  |                           |
| 13.2 | Value of expression with side effects   | Not Enforced  |                           |
| 13.3 | Full expression with increment          | Not Enforced  | Could add detection       |
| 13.4 | No assignment in condition              | **By Design** | ADR-001: `<-` vs `=`      |
| 13.5 | No function calls in boolean conditions | **Enforced**  | E0702 (Issue #254)        |
| 13.6 | sizeof operand no side effects          | **By Design** | ADR-023: sizeof validated |

---

## Rule 14 - Control Statement Expressions

| Rule | Description                                | Status        | Reference               |
| ---- | ------------------------------------------ | ------------- | ----------------------- |
| 14.1 | Loop counter float                         | **By Design** | Loop validation         |
| 14.2 | For loop well-formed                       | Partial       | Some validation         |
| 14.3 | Controlling expression not invariant       | Not Enforced  |                         |
| 14.4 | Controlling expression essentially boolean | Partial       | E0701 for do-while only |

---

## Rule 15 - Control Flow

| Rule | Description                               | Status        | Reference                |
| ---- | ----------------------------------------- | ------------- | ------------------------ |
| 15.1 | goto shall not be used                    | **By Design** | ADR-028: No goto         |
| 15.2 | goto only forward to same/enclosing block | **By Design** | No goto                  |
| 15.3 | goto in same function                     | **By Design** | No goto                  |
| 15.4 | One break/goto per loop                   | Partial       | break allowed, no goto   |
| 15.5 | Single exit point                         | Not Enforced  | Multiple returns allowed |
| 15.6 | Compound statement for control            | Partial       | Braces often required    |
| 15.7 | else required for if-else-if              | Not Enforced  |                          |

---

## Rule 16 - Switch Statements

| Rule | Description                    | Status        | Reference               |
| ---- | ------------------------------ | ------------- | ----------------------- |
| 16.1 | Switch well-formed             | **Enforced**  | ADR-025                 |
| 16.2 | Top-level switch label         | **By Design** | Grammar enforces        |
| 16.3 | Every switch clause terminated | **Enforced**  | ADR-025: No fallthrough |
| 16.4 | Every switch has default       | **Enforced**  | ADR-025                 |
| 16.5 | Default first or last          | Not Enforced  |                         |
| 16.6 | Non-empty switch               | **By Design** | Grammar requires cases  |
| 16.7 | Switch expression not boolean  | Not Enforced  |                         |

---

## Rule 17 - Functions

| Rule | Description                        | Status        | Reference              |
| ---- | ---------------------------------- | ------------- | ---------------------- |
| 17.1 | No stdarg.h                        | **By Design** | No variadic functions  |
| 17.2 | No recursion                       | Not Enforced  | Could add detection    |
| 17.3 | Function declared before use       | **By Design** | Module system          |
| 17.4 | All exit paths return value        | Partial       | Some detection         |
| 17.5 | Array parameter size               | **By Design** | Arrays have size info  |
| 17.6 | Array not modified via parameter   | **By Design** | ADR-006: pass-by-value |
| 17.7 | Return value used or explicit void | Partial       | Some checking          |
| 17.8 | Parameter not modified             | **By Design** | ADR-006: pass-by-value |

---

## Rule 18 - Pointers and Arrays

| Rule | Description                   | Status        | Reference              |
| ---- | ----------------------------- | ------------- | ---------------------- |
| 18.1 | Pointer arithmetic in bounds  | **By Design** | No pointer arithmetic  |
| 18.2 | Subtraction on same array     | **By Design** | No pointer arithmetic  |
| 18.3 | Relational on same object     | **By Design** | No pointer comparison  |
| 18.4 | No +, -, += , -= on pointers  | **By Design** | No pointer arithmetic  |
| 18.5 | Max two levels of indirection | **By Design** | No raw pointers        |
| 18.6 | No pointer to auto            | N/A           | No address-of operator |
| 18.7 | No flexible array members     | **By Design** | Not in grammar         |
| 18.8 | No VLAs                       | **By Design** | Static allocation only |

---

## Rule 19 - Overlapping Storage

| Rule | Description                        | Status  | Reference          |
| ---- | ---------------------------------- | ------- | ------------------ |
| 19.1 | Object not assigned to overlapping | Partial | Union restrictions |
| 19.2 | Union only for packing             | Partial | ADR-018: Unions    |

---

## Rule 20 - Preprocessing Directives

| Rule  | Description                        | Status       | Reference       |
| ----- | ---------------------------------- | ------------ | --------------- |
| 20.1  | #include preceded only by comments | N/A          | No preprocessor |
| 20.2  | No ' " \ in header names           | N/A          | No preprocessor |
| 20.3  | #include with <> or ""             | N/A          | Module system   |
| 20.4  | No macro with keyword name         | N/A          | No macros       |
| 20.5  | No #undef                          | N/A          | No macros       |
| 20.6  | No macro parameter in # or ##      | N/A          | No macros       |
| 20.7  | Macro parameters in parentheses    | N/A          | No macros       |
| 20.8  | #if conditions well-defined        | N/A          | No preprocessor |
| 20.9  | All identifiers in #if defined     | N/A          | No preprocessor |
| 20.10 | No # or ## operators               | N/A          | No macros       |
| 20.11 | Macro parameter after # is not ##  | N/A          | No macros       |
| 20.12 | Macro parameter used once per ##   | N/A          | No macros       |
| 20.13 | No continuation in // comment      | **Enforced** | ADR-043         |
| 20.14 | All #else/#elif after #if          | N/A          | No preprocessor |

---

## Rule 21 - Standard Libraries

| Rule  | Description                      | Status        | Reference                    |
| ----- | -------------------------------- | ------------- | ---------------------------- |
| 21.1  | No #define/#undef reserved names | N/A           | No macros                    |
| 21.2  | No reserved identifiers          | **By Design** | Scope prefixing              |
| 21.3  | No stdlib memory functions       | **By Design** | ADR-003, ADR-101             |
| 21.4  | No setjmp.h                      | **By Design** | Not accessible               |
| 21.5  | No signal.h                      | **By Design** | Not accessible               |
| 21.6  | No stdio.h for input             | Partial       | Stream functions restricted  |
| 21.7  | No atof, atoi, atol, atoll       | **By Design** | Not accessible               |
| 21.8  | No abort, exit, etc.             | Partial       | Some restrictions            |
| 21.9  | No bsearch, qsort                | **By Design** | Function pointers restricted |
| 21.10 | No time.h                        | Not Enforced  | Could restrict               |
| 21.11 | No tgmath.h                      | N/A           | C11 feature                  |
| 21.12 | No fenv.h exception functions    | Not Enforced  |                              |

---

## Rule 22 - Resources

| Rule | Description                          | Status        | Reference                  |
| ---- | ------------------------------------ | ------------- | -------------------------- |
| 22.1 | Dynamically obtained resources freed | **By Design** | No dynamic allocation      |
| 22.2 | Free only dynamic memory             | **By Design** | No free()                  |
| 22.3 | File opened once                     | Not Enforced  |                            |
| 22.4 | Read-only file not written           | Not Enforced  |                            |
| 22.5 | No pointer to FILE                   | **By Design** | No FILE pointers           |
| 22.6 | FILE pointer valid                   | **By Design** | Stream functions validated |

---

## Future Work

### High Priority

- **Rule 14.4**: Extend boolean condition validation to if/while/for (currently only do-while)
- **Rule 17.2**: Add recursion detection
- **Rule 2.1/2.2**: Dead code detection

### Medium Priority

- **Rule 12.1**: Precedence clarity warnings
- **Rule 7.1**: Octal constant detection
- **Rule 15.7**: Require else in if-else-if chains

### Low Priority

- **Rule 5.9**: Internal identifier uniqueness
- **Rule 10.x**: Complete essential type model

---

## References

- [MISRA C:2012 Guidelines](https://www.misra.org.uk/misra-c/)
- [ADR Index](./decisions/)
- [C-Next Error Codes](../src/codegen/errors.md)

---

_Last updated: 2026-02-22_
_Based on MISRA C:2012 with Amendment 2_
