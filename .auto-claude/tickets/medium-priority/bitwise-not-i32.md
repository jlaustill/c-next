# Ticket: Bitwise Operators - i32 NOT

## Description
Write test for ~i32 bitwise NOT operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise NOT (complement) operation on i32 operand.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-not-i32.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ~i32
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise NOT of i32 values
- Verify the transpiled C code correctly handles signed 32-bit complement
- Test with positive and negative values
- Example syntax:
  ```
  i32 a <- 0;
  i32 result <- ~a;  // Expected: -1 (0xFFFFFFFF in two's complement)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
