# Ticket: Comparison Operators - i8 > i8

## Description
Write test for i8 greater-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Greater-than comparison between two i8 values.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/i8-greater-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 > i8
- [ ] Jest test runner passes

## Test Implementation Notes
- Test greater-than comparison between i8 variables
- Test both true and false cases
- Test with negative values
- Test with boundary values (-128, 127)
- Example syntax:
  ```
  i8 a <- 20;
  i8 b <- -10;
  i8 c <- 20;
  bool gt1 <- (a > b);  // true
  bool gt2 <- (b > a);  // false
  bool gt3 <- (a > c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
