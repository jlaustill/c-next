# Ticket: Bitmap Declaration - bitmap32

## Description
Write test for 32-bit bitmap declaration and usage in C-Next.

## Test Category
Bitmap Declaration

## Context Being Tested
32-bit bitmap type for hardware registers and packed data structures with 32 usable bits.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bitmap/bitmap-32.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for bitmap32
- [ ] Jest test runner passes

## Test Implementation Notes
- Follow patterns from `tests/bitmap/basic-bitmap.cnx` and `tests/bitmap/bitmap-16.cnx`
- Test declaration of a 32-bit bitmap type (common for 32-bit MCU registers)
- Include a mix of single-bit flags and multi-bit fields
- Ensure total bits sum to exactly 32
- Test field read and write operations
- Example syntax:
  ```
  bitmap32 GPIOControl {
      Mode[4],           // bits 0-3 (4 bits) - mode select
      Speed[2],          // bits 4-5 (2 bits) - speed setting
      PullUp,            // bit 6 - pull-up enable
      PullDown,          // bit 7 - pull-down enable
      OutputType,        // bit 8 - push-pull vs open-drain
      AlternateFunc[4],  // bits 9-12 (4 bits) - AF selection
      Reserved[19]       // bits 13-31 (19 bits) - reserved
  }

  GPIOControl ctrl <- 0;

  void main() {
      ctrl.Mode <- 0x0F;
      ctrl.Speed <- 3;
      ctrl.PullUp <- true;
      u8 mode <- ctrl.Mode;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
