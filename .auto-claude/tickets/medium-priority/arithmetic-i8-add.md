# Ticket: Arithmetic Operators - i8 Addition

## Description
Write test for i8 + i8 addition operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Addition operation between two i8 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/arithmetic-i8-add.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 + i8
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic addition of two i8 values
- Verify the transpiled C code correctly handles signed i8 arithmetic
- Test with negative values and edge cases near type bounds (-128, 127)
- Example syntax:
  ```
  i8 a <- 50;
  i8 b <- -25;
  i8 sum <- a + b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
