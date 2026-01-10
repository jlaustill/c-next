# Ticket: C Interoperability - Use C Macro Constant

## Description
Write test for using C macro constants in C-Next code.

## Test Category
C Interoperability

## Context Being Tested
Using preprocessor-defined constants from C headers (like `NULL`, `EOF`, `INT_MAX`) in C-Next code.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/c-interop/use-c-macro-constant.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Use C macro constant
- [ ] Jest test runner passes

## Test Implementation Notes
- Include appropriate C header for macro constants (e.g., `<limits.h>` for `INT_MAX`)
- Use macro constants in expressions, comparisons, or initializations
- Example: `u32 maxVal <- INT_MAX;` or comparison `if (value < INT_MAX)`
- Verify transpiled C code correctly references macro constants
- Test should compile and run correctly with C compiler

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
