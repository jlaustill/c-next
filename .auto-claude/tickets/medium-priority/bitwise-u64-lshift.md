# Ticket: Bitwise Operators - u64 Left Shift

## Description
Write test for u64 << amount left shift operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Left shift operation on u64 operand with literal shift amount.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u64-lshift.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 << amount
- [ ] Jest test runner passes

## Test Implementation Notes
- Test left shift of u64 values by various amounts
- Verify the transpiled C code correctly handles 64-bit left shift
- Test shift amounts including high values (e.g., 32, 48, 63)
- Example syntax:
  ```
  u64 a <- 0x0000000000000001;
  u64 result <- a << 32;  // Expected: 0x0000000100000000
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
