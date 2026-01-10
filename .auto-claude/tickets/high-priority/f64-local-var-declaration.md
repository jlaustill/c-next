# Ticket: Primitive Types - f64 Local Variable Declaration

## Description
Write test for f64 local variable declaration in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Local variable declaration with f64 type without initialization inside a function.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-local-var-declaration.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Local variable declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a local f64 variable inside a function without initialization
- Verify the transpiled C code uses the correct double type
- Example syntax:
  ```
  void testFunction() {
      f64 localDouble;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
