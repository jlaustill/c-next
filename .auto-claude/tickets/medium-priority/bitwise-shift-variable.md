# Ticket: Bitwise Operators - Shift by Variable

## Description
Write test for left shift operation with variable shift amount in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Left shift operation where the shift amount is a variable rather than a literal.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-shift-variable.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Shift by variable
- [ ] Jest test runner passes

## Test Implementation Notes
- Test left shift with shift amount stored in a variable
- Verify the transpiled C code correctly handles dynamic shift amounts
- Test with u32 (well-tested baseline) and other types if appropriate
- Example syntax:
  ```
  u32 value <- 0x00000001;
  u32 amount <- 4;
  u32 result <- value << amount;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
