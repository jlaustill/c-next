# Ticket: Comparison Operators - u16 < u16

## Description
Write test for u16 less-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Less-than comparison between two u16 values.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/u16-less-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 < u16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test less-than comparison between u16 variables
- Test both true and false cases
- Test with boundary values (0, 65535)
- Example syntax:
  ```
  u16 a <- 1000;
  u16 b <- 2000;
  u16 c <- 1000;
  bool lt1 <- (a < b);  // true
  bool lt2 <- (b < a);  // false
  bool lt3 <- (a < c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
