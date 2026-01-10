# Ticket: Register Declaration - Bit Range Access

## Description
Write test for bit range access on register fields in C-Next.

## Test Category
Register Declaration

## Context Being Tested
Accessing a range of bits within a register field using bit range syntax.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/register/register-bit-range-access.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Bit range access"
- [ ] Jest test runner passes

## Test Implementation Notes
- Follow patterns from `tests/register/register-bit-indexing.cnx` and `tests/bit-indexing/bit-range-read.cnx`
- Test reading and writing bit ranges within register fields
- Use the [start..end] syntax for bit range access
- Verify proper masking and shifting in generated C code
- Example syntax:
  ```
  register GPIO @ 0x40020000 {
      MODER: u32 rw @ 0x00,  // Mode register
      ODR:   u32 rw @ 0x14,  // Output data register
  }

  void main() {
      // Write to a bit range within register
      GPIO.MODER[3..0] <- 0x05;  // Set mode for pin 0 and 1
      GPIO.MODER[7..4] <- 0x0A;  // Set mode for pin 2 and 3

      // Read a bit range from register
      u8 pin0Mode <- GPIO.MODER[1..0];
      u8 pin1Mode <- GPIO.MODER[3..2];

      // Combine operations
      GPIO.ODR[7..0] <- 0xFF;  // Set lower 8 bits of output
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
