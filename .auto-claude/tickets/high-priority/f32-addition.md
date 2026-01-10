# Ticket: Arithmetic Operators - f32 + f32

## Description
Write test for f32 addition operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Addition operation between two f32 values.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/arithmetic/f32-addition.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 + f32
- [ ] Jest test runner passes

## Test Implementation Notes
- Test addition between f32 variables
- Test addition with literals
- Test addition with negative values
- Verify precision handling
- Example syntax:
  ```
  f32 a <- 3.14;
  f32 b <- 2.0;
  f32 sum <- a + b;  // 5.14
  f32 sumLit <- a + 1.5;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
