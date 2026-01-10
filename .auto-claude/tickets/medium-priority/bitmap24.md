# Ticket: Bitmap Declaration - bitmap24

## Description
Write test for 24-bit bitmap declaration and usage in C-Next.

## Test Category
Bitmap Declaration

## Context Being Tested
24-bit bitmap type for hardware registers and packed data structures with 24 usable bits.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bitmap/bitmap-24.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for bitmap24
- [ ] Jest test runner passes

## Test Implementation Notes
- Follow patterns from `tests/bitmap/basic-bitmap.cnx` and `tests/bitmap/bitmap-16.cnx`
- Test declaration of a 24-bit bitmap type
- Include a mix of single-bit and multi-bit fields
- Ensure total bits sum to exactly 24
- Test field read and write operations
- Example syntax:
  ```
  bitmap24 RGBPixel {
      Red[8],        // bits 0-7 (8 bits)
      Green[8],      // bits 8-15 (8 bits)
      Blue[8]        // bits 16-23 (8 bits)
  }

  RGBPixel pixel <- 0;

  void main() {
      pixel.Red <- 255;
      pixel.Green <- 128;
      pixel.Blue <- 64;
      u8 red <- pixel.Red;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
