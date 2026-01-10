# Ticket: Arithmetic Operators - f32 - f32

## Description
Write test for f32 subtraction operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Subtraction operation between two f32 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/arithmetic/f32-subtraction.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 - f32
- [ ] Jest test runner passes

## Test Implementation Notes
- Test subtraction between f32 variables
- Test subtraction with literals
- Test subtraction resulting in negative values
- Verify precision handling
- Example syntax:
  ```
  f32 a <- 5.5;
  f32 b <- 2.0;
  f32 diff <- a - b;  // 3.5
  f32 negative <- b - a;  // -3.5
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
