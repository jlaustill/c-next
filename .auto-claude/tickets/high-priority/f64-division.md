# Ticket: Arithmetic Operators - f64 / f64

## Description
Write test for f64 division operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Division operation between two f64 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/arithmetic/f64-division.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 / f64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test division between f64 variables
- Test division with literals
- Test division with negative values
- Test division resulting in fractional values
- Verify precision with irrational results
- Example syntax:
  ```
  f64 a <- 22.0;
  f64 b <- 7.0;
  f64 quotient <- a / b;  // ~3.142857...
  f64 negQuotient <- a / -2.0;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
