# Ticket: Primitive Types - f64 Function Return Type

## Description
Write test for f64 as a function return type in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Function with f64 return type.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-function-return.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Function return type
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that returns an f64 value
- Verify the transpiled C code correctly declares the double return type
- Example syntax:
  ```
  f64 getDouble() {
      return 1.5;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
