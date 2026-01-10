# Ticket: Comparison Operators - f64 > f64

## Description
Write test for f64 greater-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Greater-than comparison between two f64 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/f64-greater-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 > f64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test greater-than comparison between f64 variables
- Test both true and false cases
- Test with negative values
- Example syntax:
  ```
  f64 a <- 3.14159;
  f64 b <- 2.718;
  f64 c <- 3.14159;
  bool gt1 <- (a > b);  // true
  bool gt2 <- (b > a);  // false
  bool gt3 <- (a > c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
