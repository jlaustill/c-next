# Ticket: Bitwise Operators - i64 AND

## Description
Write test for i64 & i64 bitwise AND operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise AND operation between two i64 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-i64-and.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 & i64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic bitwise AND of two i64 values
- Verify the transpiled C code correctly handles signed 64-bit bitwise AND
- Test with negative values and sign bit interactions across full range
- Example syntax:
  ```
  i64 a <- -1;  // All ones in two's complement
  i64 b <- 0x00000000FFFFFFFF;
  i64 result <- a & b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
