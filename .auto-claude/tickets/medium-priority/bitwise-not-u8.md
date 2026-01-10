# Ticket: Bitwise Operators - u8 NOT

## Description
Write test for ~u8 bitwise NOT operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise NOT (complement) operation on u8 operand.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-not-u8.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ~u8
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise NOT of u8 values
- Verify the transpiled C code correctly handles 8-bit complement
- Test with all zeros (expect all ones), all ones (expect all zeros), and patterns
- Example syntax:
  ```
  u8 a <- 0b11110000;
  u8 result <- ~a;  // Expected: 0b00001111
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
