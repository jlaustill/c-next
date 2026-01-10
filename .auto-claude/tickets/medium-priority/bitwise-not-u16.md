# Ticket: Bitwise Operators - u16 NOT

## Description
Write test for ~u16 bitwise NOT operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise NOT (complement) operation on u16 operand.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-not-u16.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ~u16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise NOT of u16 values
- Verify the transpiled C code correctly handles 16-bit complement
- Test with various patterns
- Example syntax:
  ```
  u16 a <- 0xFF00;
  u16 result <- ~a;  // Expected: 0x00FF
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
