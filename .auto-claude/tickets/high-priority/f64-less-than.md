# Ticket: Comparison Operators - f64 < f64

## Description
Write test for f64 less-than comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Less-than comparison between two f64 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/f64-less-than.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 < f64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test less-than comparison between f64 variables
- Test both true and false cases
- Test with negative values
- Example syntax:
  ```
  f64 a <- 2.718;
  f64 b <- 3.14159;
  f64 c <- 2.718;
  bool lt1 <- (a < b);  // true
  bool lt2 <- (b < a);  // false
  bool lt3 <- (a < c);  // false (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
