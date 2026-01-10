# Ticket: Bitwise Operators - i16 AND

## Description
Write test for i16 & i16 bitwise AND operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise AND operation between two i16 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-i16-and.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 & i16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic bitwise AND of two i16 values
- Verify the transpiled C code correctly handles signed 16-bit bitwise AND
- Test with negative values and sign bit interactions
- Example syntax:
  ```
  i16 a <- -1;  // 0xFFFF in two's complement
  i16 b <- 0x00FF;
  i16 result <- a & b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
