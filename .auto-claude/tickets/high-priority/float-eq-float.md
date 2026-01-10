# Ticket: Comparison Operators - Float = Float

## Description
Write test for float equality comparison (Float = Float) in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Equality comparison between two float variables.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/float-eq-float.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Float = Float
- [ ] Jest test runner passes

## Test Implementation Notes
- Test equality comparison between f32 variables
- Test equality comparison between f64 variables
- Test both true and false cases
- Example syntax:
  ```
  f32 a <- 3.14;
  f32 b <- 3.14;
  f32 c <- 2.0;
  bool eq1 <- (a = b);  // true
  bool eq2 <- (a = c);  // false
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
