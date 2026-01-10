# Ticket: Arithmetic Operators - f64 + f64

## Description
Write test for f64 addition operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Addition operation between two f64 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/arithmetic/f64-addition.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 + f64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test addition between f64 variables
- Test addition with literals
- Test addition with negative values
- Verify precision handling
- Example syntax:
  ```
  f64 a <- 3.14159265358979;
  f64 b <- 2.71828182845904;
  f64 sum <- a + b;
  f64 sumLit <- a + 1.5;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
