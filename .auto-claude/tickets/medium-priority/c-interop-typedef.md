# Ticket: C Interoperability - Use C Typedef

## Description
Write test for using C typedef types in C-Next code.

## Test Category
C Interoperability

## Context Being Tested
Using type definitions from C headers (like `size_t`, `FILE`, etc.) in C-Next code.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/c-interop/use-c-typedef.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Use C typedef
- [ ] Jest test runner passes

## Test Implementation Notes
- Include appropriate C header for typedef (e.g., `<stddef.h>` for `size_t`)
- Declare variables using C typedef types
- Use the typedef in expressions and function calls
- Example: `size_t len <- strlen("hello");`
- Verify transpiled C code preserves typedef usage correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
