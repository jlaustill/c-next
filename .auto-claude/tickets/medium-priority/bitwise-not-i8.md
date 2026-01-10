# Ticket: Bitwise Operators - i8 NOT

## Description
Write test for ~i8 bitwise NOT operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise NOT (complement) operation on i8 operand.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-not-i8.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ~i8
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise NOT of i8 values
- Verify the transpiled C code correctly handles signed 8-bit complement
- Test with positive and negative values
- Example syntax:
  ```
  i8 a <- 0;
  i8 result <- ~a;  // Expected: -1 (0xFF in two's complement)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
