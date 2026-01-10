# Ticket: Arithmetic Operators - f32 / f32

## Description
Write test for f32 division operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Division operation between two f32 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/arithmetic/f32-division.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 / f32
- [ ] Jest test runner passes

## Test Implementation Notes
- Test division between f32 variables
- Test division with literals
- Test division with negative values
- Test division resulting in fractional values
- Example syntax:
  ```
  f32 a <- 10.0;
  f32 b <- 4.0;
  f32 quotient <- a / b;  // 2.5
  f32 negQuotient <- a / -2.0;  // -5.0
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
