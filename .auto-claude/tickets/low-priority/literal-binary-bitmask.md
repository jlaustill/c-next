# Ticket: Literals - Binary Bit Mask

## Description
Write test for binary literals (0b prefix) used as bit masks in C-Next.

## Test Category
Literals - Integer Literals

## Context Being Tested
Binary literals (0b prefix) used in bit mask operations.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/literals/binary-bitmask.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Binary (0b) bit mask
- [ ] Jest test runner passes

## Test Implementation Notes
- Test binary literals used in bitwise AND operations for masking
- Test binary literals used in bitwise OR operations for setting bits
- Example syntax:
  ```
  u32 value <- 0xFF;
  u32 masked <- value & 0b00001111;  // mask lower 4 bits
  u32 setBits <- value | 0b11110000; // set upper 4 bits
  ```
- Verify the transpiled C code correctly represents binary literals
- Test with different bit widths (8, 16, 32 bits)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
