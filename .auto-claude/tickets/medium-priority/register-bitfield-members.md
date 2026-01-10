# Ticket: Register Declaration - Bitfield Members

## Description
Write test for register fields with bitmap type members in C-Next.

## Test Category
Register Declaration

## Context Being Tested
Using bitmap types as register field types for structured bit access.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/register/register-bitfield-members.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Bitfield members"
- [ ] Jest test runner passes

## Test Implementation Notes
- Combine patterns from `tests/register/register-basic.cnx` and `tests/bitmap/bitmap-in-register.cnx`
- Define bitmap types for register field structure
- Use bitmap as the type for a register field
- Access named bitfields within the register
- This provides better documentation and type safety than raw bit manipulation
- Example syntax:
  ```
  bitmap32 ControlBits {
      Enable,          // bit 0
      Start,           // bit 1
      Stop,            // bit 2
      Reset,           // bit 3
      Mode[4],         // bits 4-7 (4 bits)
      Prescaler[8],    // bits 8-15 (8 bits)
      Reserved[16]     // bits 16-31 (16 bits)
  }

  register TIMER @ 0x40000000 {
      CTRL: ControlBits rw @ 0x00,  // Control register with bitfield type
      CNT:  u32 rw @ 0x04,          // Counter register
  }

  void main() {
      // Access bitfield members through register
      TIMER.CTRL.Enable <- true;
      TIMER.CTRL.Mode <- 5;
      TIMER.CTRL.Prescaler <- 100;

      // Read bitfield members
      bool isEnabled <- TIMER.CTRL.Enable;
      u8 mode <- TIMER.CTRL.Mode;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
