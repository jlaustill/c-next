# Ticket: Arithmetic Operators - u8 Subtraction

## Description
Write test for u8 - u8 subtraction operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Subtraction operation between two u8 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/arithmetic-u8-sub.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 - u8
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic subtraction of two u8 values
- Verify the transpiled C code correctly handles u8 arithmetic
- Test edge cases (e.g., 100 - 50, 255 - 0)
- Be aware of potential underflow behavior with unsigned types
- Example syntax:
  ```
  u8 a <- 100;
  u8 b <- 50;
  u8 diff <- a - b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
