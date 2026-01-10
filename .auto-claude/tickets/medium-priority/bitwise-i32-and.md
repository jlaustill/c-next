# Ticket: Bitwise Operators - i32 AND

## Description
Write test for i32 & i32 bitwise AND operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise AND operation between two i32 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-i32-and.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i32 & i32
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic bitwise AND of two i32 values
- Verify the transpiled C code correctly handles signed 32-bit bitwise AND
- Test with negative values and sign bit interactions
- Example syntax:
  ```
  i32 a <- -1;  // 0xFFFFFFFF in two's complement
  i32 b <- 0x0000FFFF;
  i32 result <- a & b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
