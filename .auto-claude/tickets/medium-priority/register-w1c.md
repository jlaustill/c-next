# Ticket: Register Declaration - w1c Access Modifier

## Description
Write test for w1c (write-1-to-clear) register access modifier in C-Next.

## Test Category
Register Declaration

## Context Being Tested
w1c access modifier for register fields that are cleared by writing a 1 (common for interrupt flags).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/register/register-w1c-modifier.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "w1c access modifier"
- [ ] Jest test runner passes

## Test Implementation Notes
- Follow patterns from `tests/register/register-access-modifiers.cnx`
- w1c (write-1-to-clear) is used for interrupt flags and status bits
- Writing 1 clears the bit, writing 0 has no effect
- Reading returns current state
- Common in interrupt status registers
- Example syntax:
  ```
  register INTERRUPT @ 0x40000000 {
      STATUS: u32 w1c @ 0x00,  // Write-1-to-clear: write 1 to clear flags
      ENABLE: u32 rw  @ 0x04,  // Read-write: normal register
  }

  void main() {
      // Clear specific interrupt flags by writing 1
      INTERRUPT.STATUS <- 0x01;  // Clear flag in bit 0

      // Read current interrupt status
      u32 status <- INTERRUPT.STATUS;

      // Clear multiple flags
      INTERRUPT.STATUS <- 0xFF;  // Clear flags in bits 0-7
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
