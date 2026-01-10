# Ticket: Primitive Types - f32 Local Variable Declaration

## Description
Write test for f32 local variable declaration in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Local variable declaration with f32 type without initialization inside a function.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-local-var-declaration.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Local variable declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a local f32 variable inside a function without initialization
- Verify the transpiled C code uses the correct float type
- Example syntax:
  ```
  void testFunction() {
      f32 localFloat;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
