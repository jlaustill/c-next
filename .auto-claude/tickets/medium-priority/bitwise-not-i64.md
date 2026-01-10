# Ticket: Bitwise Operators - i64 NOT

## Description
Write test for ~i64 bitwise NOT operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise NOT (complement) operation on i64 operand.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-not-i64.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ~i64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise NOT of i64 values
- Verify the transpiled C code correctly handles signed 64-bit complement
- Test with positive and negative values across full range
- Example syntax:
  ```
  i64 a <- 0;
  i64 result <- ~a;  // Expected: -1 (all ones in two's complement)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
