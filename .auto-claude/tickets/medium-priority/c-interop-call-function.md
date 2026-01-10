# Ticket: C Interoperability - Call C Function

## Description
Write test for calling C functions from C-Next code.

## Test Category
C Interoperability

## Context Being Tested
Calling external C functions declared via `#include` directives from C-Next code.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/c-interop/call-c-function.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Call C function
- [ ] Jest test runner passes

## Test Implementation Notes
- Include a standard C header (e.g., `<stdio.h>` or `<string.h>`)
- Call a C function like `strlen` or `memset`
- Verify correct parameter passing and return value handling
- Example: use `strlen` on a string literal and assign result
- Transpiled C code should generate valid function calls

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
