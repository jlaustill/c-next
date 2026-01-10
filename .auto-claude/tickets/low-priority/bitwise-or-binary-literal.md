# Ticket: Bitwise Operators - OR with Binary Literal

## Description
Write test for bitwise OR (|) operator used with binary literals in C-Next.

## Test Category
Bitwise Operators - OR (|)

## Context Being Tested
Bitwise OR operation with binary literal operands.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/bitwise/or-binary-literal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With binary literal" in section 5.2 OR (|)
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise OR with binary literal as right operand
- Test bitwise OR with binary literal as left operand
- Example syntax:
  ```
  u32 value <- 0x00;
  u32 setBits <- value | 0b11110000;  // set upper 4 bits
  u32 result <- 0b00001111 | value;   // binary on left side
  ```
- Test with common bit-setting patterns using binary notation
- Binary literals make bit patterns visually clear for setting operations
- Verify the transpiled C code correctly represents binary literals in OR operations
- Test with different integer types (u8, u16, u32)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
