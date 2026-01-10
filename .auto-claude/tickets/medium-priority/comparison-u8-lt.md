# Ticket: Comparison Operators - u8 < u8

## Description
Write test for u8 less-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Less-than comparison between two u8 values.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/u8-less-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 < u8
- [ ] Jest test runner passes

## Test Implementation Notes
- Test less-than comparison between u8 variables
- Test both true and false cases
- Test with boundary values (0, 255)
- Example syntax:
  ```
  u8 a <- 10;
  u8 b <- 20;
  u8 c <- 10;
  bool lt1 <- (a < b);  // true
  bool lt2 <- (b < a);  // false
  bool lt3 <- (a < c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
