# Ticket: Bitwise Operators - u16 Right Shift

## Description
Write test for u16 >> amount right shift operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Right shift operation on u16 operand with literal shift amount.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u16-rshift.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 >> amount
- [ ] Jest test runner passes

## Test Implementation Notes
- Test right shift of u16 values by various amounts
- Verify the transpiled C code correctly handles 16-bit logical right shift
- Test shift amounts from 0 to 15
- Unsigned types use logical right shift (zero fill)
- Example syntax:
  ```
  u16 a <- 0x8000;
  u16 result <- a >> 8;  // Expected: 0x0080
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
