# Ticket: Bitwise Operators - u8 Right Shift

## Description
Write test for u8 >> amount right shift operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Right shift operation on u8 operand with literal shift amount.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u8-rshift.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 >> amount
- [ ] Jest test runner passes

## Test Implementation Notes
- Test right shift of u8 values by various amounts
- Verify the transpiled C code correctly handles 8-bit logical right shift
- Test shift amounts from 0 to 7
- Unsigned types use logical right shift (zero fill)
- Example syntax:
  ```
  u8 a <- 0b10000000;
  u8 result <- a >> 4;  // Expected: 0b00001000
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
