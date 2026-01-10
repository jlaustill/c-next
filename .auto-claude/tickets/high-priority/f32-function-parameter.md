# Ticket: Primitive Types - f32 Function Parameter

## Description
Write test for f32 as a function parameter type in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Function parameter with f32 type.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-function-parameter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Function parameter
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that takes an f32 parameter
- Verify the transpiled C code correctly declares the float parameter
- Example syntax:
  ```
  void processFloat(f32 value) {
      // use value
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
