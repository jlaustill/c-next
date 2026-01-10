# Ticket: Bitwise Operators - u64 AND

## Description
Write test for u64 & u64 bitwise AND operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise AND operation between two u64 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u64-and.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 & u64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic bitwise AND of two u64 values
- Verify the transpiled C code correctly handles 64-bit bitwise AND
- Test with various bit patterns across full 64-bit range
- Example syntax:
  ```
  u64 a <- 0xFFFFFFFF00000000;
  u64 b <- 0x0F0F0F0F0F0F0F0F;
  u64 result <- a & b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
