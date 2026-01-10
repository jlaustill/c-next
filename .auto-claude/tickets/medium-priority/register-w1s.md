# Ticket: Register Declaration - w1s Access Modifier

## Description
Write test for w1s (write-1-to-set) register access modifier in C-Next.

## Test Category
Register Declaration

## Context Being Tested
w1s access modifier for register fields that are set by writing a 1 (common for triggering actions).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/register/register-w1s-modifier.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "w1s access modifier"
- [ ] Jest test runner passes

## Test Implementation Notes
- Follow patterns from `tests/register/register-access-modifiers.cnx`
- w1s (write-1-to-set) is used for trigger/command bits
- Writing 1 sets the bit, writing 0 has no effect
- Often paired with w1c for complementary clear operations
- Common in control registers for software-triggered events
- Example syntax:
  ```
  register CONTROL @ 0x40000000 {
      SET:   u32 w1s @ 0x00,  // Write-1-to-set: write 1 to set bits
      CLEAR: u32 w1c @ 0x04,  // Write-1-to-clear: write 1 to clear bits
      READ:  u32 ro  @ 0x08,  // Read-only: current state
  }

  void main() {
      // Set specific bits by writing 1
      CONTROL.SET <- 0x01;  // Set bit 0

      // Set multiple bits at once
      CONTROL.SET <- 0x0F;  // Set bits 0-3

      // Read current state
      u32 state <- CONTROL.READ;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
