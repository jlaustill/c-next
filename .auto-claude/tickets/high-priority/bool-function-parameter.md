# Ticket: Primitive Types - Boolean Function Parameter

## Description
Write test for boolean as a function parameter type in C-Next.

## Test Category
Primitive Types - Boolean

## Context Being Tested
Function parameter with bool type.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/bool-function-parameter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Boolean Function parameter
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that takes a bool parameter
- Verify the transpiled C code correctly declares the bool parameter
- Example syntax:
  ```
  void processFlag(bool enabled) {
      // use enabled
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
