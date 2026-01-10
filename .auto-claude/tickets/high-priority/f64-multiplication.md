# Ticket: Arithmetic Operators - f64 * f64

## Description
Write test for f64 multiplication operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Multiplication operation between two f64 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/arithmetic/f64-multiplication.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 * f64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test multiplication between f64 variables
- Test multiplication with literals
- Test multiplication with negative values
- Test multiplication by zero and one
- Verify precision with large products
- Example syntax:
  ```
  f64 a <- 3.14159265358979;
  f64 b <- 2.0;
  f64 product <- a * b;
  f64 negProduct <- a * -2.0;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
