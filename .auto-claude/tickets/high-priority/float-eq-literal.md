# Ticket: Comparison Operators - Float = Literal

## Description
Write test for float equality comparison with literal (Float = Literal) in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Equality comparison between a float variable and a literal value.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/float-eq-literal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Float = Literal
- [ ] Jest test runner passes

## Test Implementation Notes
- Test equality comparison between f32 variable and decimal literal
- Test equality comparison between f64 variable and decimal literal
- Test with typed literal suffixes (f32, f64)
- Example syntax:
  ```
  f32 a <- 3.14;
  bool eq1 <- (a = 3.14);
  bool eq2 <- (a = 3.14f32);

  f64 b <- 2.718;
  bool eq3 <- (b = 2.718);
  bool eq4 <- (b = 2.718f64);
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
