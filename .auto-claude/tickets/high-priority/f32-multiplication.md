# Ticket: Arithmetic Operators - f32 * f32

## Description
Write test for f32 multiplication operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Multiplication operation between two f32 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/arithmetic/f32-multiplication.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 * f32
- [ ] Jest test runner passes

## Test Implementation Notes
- Test multiplication between f32 variables
- Test multiplication with literals
- Test multiplication with negative values
- Test multiplication by zero and one
- Example syntax:
  ```
  f32 a <- 3.0;
  f32 b <- 2.5;
  f32 product <- a * b;  // 7.5
  f32 negProduct <- a * -2.0;  // -6.0
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
