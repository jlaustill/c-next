# Ticket: Comparison Operators - i64 > i64

## Description
Write test for i64 greater-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Greater-than comparison between two i64 values.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/i64-greater-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 > i64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test greater-than comparison between i64 variables
- Test both true and false cases
- Test with negative values
- Test with large values that require 64-bit representation
- Example syntax:
  ```
  i64 a <- 2000000000000;
  i64 b <- -1000000000000;
  i64 c <- 2000000000000;
  bool gt1 <- (a > b);  // true
  bool gt2 <- (b > a);  // false
  bool gt3 <- (a > c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
