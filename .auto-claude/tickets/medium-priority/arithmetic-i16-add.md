# Ticket: Arithmetic Operators - i16 Addition

## Description
Write test for i16 + i16 addition operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Addition operation between two i16 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/arithmetic-i16-add.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 + i16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic addition of two i16 values
- Verify the transpiled C code correctly handles signed i16 arithmetic
- Test with negative values and edge cases near type bounds (-32768, 32767)
- Example syntax:
  ```
  i16 a <- 1000;
  i16 b <- -500;
  i16 sum <- a + b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
