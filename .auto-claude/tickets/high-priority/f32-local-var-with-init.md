# Ticket: Primitive Types - f32 Local Variable with Init

## Description
Write test for f32 local variable declaration with initialization in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Local variable declaration with f32 type with initial value inside a function.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-local-var-with-init.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Local variable with init
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a local f32 variable inside a function with initialization
- Verify the transpiled C code uses the correct float type and value
- Example syntax:
  ```
  void testFunction() {
      f32 localFloat <- 2.718;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
