# Ticket: Comparison Operators - i16 > i16

## Description
Write test for i16 greater-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Greater-than comparison between two i16 values.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/i16-greater-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 > i16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test greater-than comparison between i16 variables
- Test both true and false cases
- Test with negative values
- Test with boundary values (-32768, 32767)
- Example syntax:
  ```
  i16 a <- 2000;
  i16 b <- -1000;
  i16 c <- 2000;
  bool gt1 <- (a > b);  // true
  bool gt2 <- (b > a);  // false
  bool gt3 <- (a > c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
