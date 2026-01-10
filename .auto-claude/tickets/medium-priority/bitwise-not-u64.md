# Ticket: Bitwise Operators - u64 NOT

## Description
Write test for ~u64 bitwise NOT operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise NOT (complement) operation on u64 operand.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-not-u64.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ~u64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise NOT of u64 values
- Verify the transpiled C code correctly handles 64-bit complement
- Test with various patterns across full 64-bit range
- Example syntax:
  ```
  u64 a <- 0xFFFFFFFF00000000;
  u64 result <- ~a;  // Expected: 0x00000000FFFFFFFF
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
