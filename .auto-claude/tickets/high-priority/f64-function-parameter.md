# Ticket: Primitive Types - f64 Function Parameter

## Description
Write test for f64 as a function parameter type in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Function parameter with f64 type.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-function-parameter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Function parameter
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that takes an f64 parameter
- Verify the transpiled C code correctly declares the double parameter
- Example syntax:
  ```
  void processDouble(f64 value) {
      // use value
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
