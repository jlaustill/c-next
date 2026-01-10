# Ticket: Bitwise Operators - u64 Right Shift

## Description
Write test for u64 >> amount right shift operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Right shift operation on u64 operand with literal shift amount.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u64-rshift.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 >> amount
- [ ] Jest test runner passes

## Test Implementation Notes
- Test right shift of u64 values by various amounts
- Verify the transpiled C code correctly handles 64-bit logical right shift
- Test shift amounts including high values (e.g., 32, 48, 63)
- Unsigned types use logical right shift (zero fill)
- Example syntax:
  ```
  u64 a <- 0x8000000000000000;
  u64 result <- a >> 32;  // Expected: 0x0000000080000000
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
