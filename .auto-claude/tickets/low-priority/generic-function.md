# Ticket: Generic Types - Generic Function

## Description
Write test for generic function declarations in C-Next.

## Test Category
Generic Types

## Context Being Tested
Generic function - a function that can operate on multiple types using type parameters.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/generic-types/generic-function.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Generic function
- [ ] Jest test runner passes

## Test Implementation Notes
- Test declaring and calling a generic function
- Verify the transpiler correctly handles generic function syntax
- Example syntax:
  ```
  fn swap<T>(ref a: T, ref b: T) -> void {
      temp: T <- a;
      a <- b;
      b <- temp;
  }
  ```
- Note: Generic types are defined in grammar but implementation status is unclear
- This test may reveal that generic functions need to be fully implemented

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
