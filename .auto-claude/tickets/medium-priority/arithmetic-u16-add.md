# Ticket: Arithmetic Operators - u16 Addition

## Description
Write test for u16 + u16 addition operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Addition operation between two u16 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/arithmetic-u16-add.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 + u16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic addition of two u16 values
- Verify the transpiled C code correctly handles u16 arithmetic
- Test edge cases near type bounds (e.g., 65535 + 0, 32768 + 32767)
- Example syntax:
  ```
  u16 a <- 1000;
  u16 b <- 500;
  u16 sum <- a + b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
