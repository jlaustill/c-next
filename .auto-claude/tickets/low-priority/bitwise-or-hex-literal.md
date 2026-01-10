# Ticket: Bitwise Operators - OR with Hex Literal

## Description
Write test for bitwise OR (|) operator used with hexadecimal literals in C-Next.

## Test Category
Bitwise Operators - OR (|)

## Context Being Tested
Bitwise OR operation with hexadecimal literal operands.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/bitwise/or-hex-literal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With hex literal" in section 5.2 OR (|)
- [ ] Jest test runner passes

## Test Implementation Notes
- Test bitwise OR with hex literal as right operand
- Test bitwise OR with hex literal as left operand
- Example syntax:
  ```
  u32 value <- 0x0000FFFF;
  u32 combined <- value | 0xFFFF0000;  // set upper bits
  u32 result <- 0x12340000 | value;    // hex on left side
  ```
- Test with common bit-setting patterns (0xFF, 0x0F, 0xF0, etc.)
- Verify the transpiled C code correctly represents hex literals in OR operations
- Test with different integer types (u8, u16, u32)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
