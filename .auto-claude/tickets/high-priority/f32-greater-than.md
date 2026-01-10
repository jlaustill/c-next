# Ticket: Comparison Operators - f32 > f32

## Description
Write test for f32 greater-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Greater-than comparison between two f32 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/f32-greater-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 > f32
- [ ] Jest test runner passes

## Test Implementation Notes
- Test greater-than comparison between f32 variables
- Test both true and false cases
- Test with negative values
- Example syntax:
  ```
  f32 a <- 3.14;
  f32 b <- 2.0;
  f32 c <- 3.14;
  bool gt1 <- (a > b);  // true
  bool gt2 <- (b > a);  // false
  bool gt3 <- (a > c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
