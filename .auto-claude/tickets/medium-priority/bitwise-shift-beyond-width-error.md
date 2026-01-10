# Ticket: Bitwise Operators - Shift Beyond Width Error

## Description
Write test for shift amount exceeding type width error detection in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Compiler error when shift amount equals or exceeds the bit width of the type.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-shift-beyond-width-error.cnx`
- [ ] Test produces expected compiler error
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Shift beyond width (ERROR)
- [ ] Jest test runner passes

## Test Implementation Notes
- Test that shifting by type width or more produces a compiler error
- Test for different type widths (8-bit shift by 8+, 16-bit shift by 16+, etc.)
- This is an ERROR test - expect compilation to fail
- Example syntax:
  ```
  u8 value <- 0x01;
  u8 result <- value << 8;  // ERROR: shift amount >= type width

  u32 value32 <- 0x00000001;
  u32 result32 <- value32 << 32;  // ERROR: shift amount >= type width
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
