# Ticket: Bitwise Operators - u16 OR

## Description
Write test for u16 | u16 bitwise OR operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Bitwise OR operation between two u16 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-u16-or.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 | u16
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic bitwise OR of two u16 values
- Verify the transpiled C code correctly handles 16-bit bitwise OR
- Test with various bit patterns
- Example syntax:
  ```
  u16 a <- 0xFF00;
  u16 b <- 0x00FF;
  u16 result <- a | b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
