# Ticket: Primitive Types - f32 Function Return Type

## Description
Write test for f32 as a function return type in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Function with f32 return type.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-function-return.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Function return type
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that returns an f32 value
- Verify the transpiled C code correctly declares the float return type
- Example syntax:
  ```
  f32 getFloat() {
      return 1.5;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
