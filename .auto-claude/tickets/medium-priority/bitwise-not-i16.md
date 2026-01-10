# Ticket: Bitwise Operators - i16 NOT

## Description
Write test for ~i16 bitwise NOT operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise NOT (complement) operation on i16 operand.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-not-i16.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ~i16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise NOT of i16 values
- Verify the transpiled C code correctly handles signed 16-bit complement
- Test with positive and negative values
- Example syntax:
  ```
  i16 a <- 0;
  i16 result <- ~a;  // Expected: -1 (0xFFFF in two's complement)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
