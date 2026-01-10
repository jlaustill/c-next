# Ticket: Arithmetic Operators - i64 Addition

## Description
Write test for i64 + i64 addition operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Addition operation between two i64 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/arithmetic-i64-add.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 + i64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic addition of two i64 values
- Verify the transpiled C code correctly handles signed i64 arithmetic
- Test with large positive and negative values that require 64-bit precision
- Example syntax:
  ```
  i64 a <- 1000000000;
  i64 b <- -500000000;
  i64 sum <- a + b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
