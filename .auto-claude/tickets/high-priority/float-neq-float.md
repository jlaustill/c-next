# Ticket: Comparison Operators - Float != Float

## Description
Write test for float inequality comparison (Float != Float) in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Inequality comparison between two float variables.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/float-neq-float.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Float != Float
- [ ] Jest test runner passes

## Test Implementation Notes
- Test inequality comparison between f32 variables
- Test inequality comparison between f64 variables
- Test both true and false cases
- Example syntax:
  ```
  f32 a <- 3.14;
  f32 b <- 2.0;
  f32 c <- 3.14;
  bool neq1 <- (a != b);  // true
  bool neq2 <- (a != c);  // false
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
