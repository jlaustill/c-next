# Ticket: Bitwise Operators - u16 Left Shift

## Description
Write test for u16 << amount left shift operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Left shift operation on u16 operand with literal shift amount.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u16-lshift.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 << amount
- [ ] Jest test runner passes

## Test Implementation Notes
- Test left shift of u16 values by various amounts
- Verify the transpiled C code correctly handles 16-bit left shift
- Test shift amounts from 0 to 15
- Example syntax:
  ```
  u16 a <- 0x0001;
  u16 result <- a << 8;  // Expected: 0x0100
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
