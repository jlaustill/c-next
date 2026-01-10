# Ticket: Bitwise Operators - AND with Binary Literal

## Description
Write test for bitwise AND (&) operator used with binary literals in C-Next.

## Test Category
Bitwise Operators - AND (&)

## Context Being Tested
Bitwise AND operation with binary literal operands.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/bitwise/and-binary-literal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With binary literal" in section 5.1 AND (&)
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise AND with binary literal as right operand
- Test bitwise AND with binary literal as left operand
- Example syntax:
  ```
  u32 value <- 0xFF;
  u32 masked <- value & 0b00001111;  // mask lower 4 bits
  u32 result <- 0b11110000 & value;  // binary on left side
  ```
- Test with common bit mask patterns using binary notation
- Binary literals make bit patterns visually clear for masking operations
- Verify the transpiled C code correctly represents binary literals in AND operations
- Test with different integer types (u8, u16, u32)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
