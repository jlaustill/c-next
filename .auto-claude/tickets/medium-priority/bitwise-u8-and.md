# Ticket: Bitwise Operators - u8 AND

## Description
Write test for u8 & u8 bitwise AND operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise AND operation between two u8 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u8-and.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 & u8
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic bitwise AND of two u8 values
- Verify the transpiled C code correctly handles 8-bit bitwise AND
- Test with various bit patterns (all zeros, all ones, alternating)
- Example syntax:
  ```
  u8 a <- 0b11110000;
  u8 b <- 0b10101010;
  u8 result <- a & b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
