# Ticket: Bitwise Operators - i32 Arithmetic Right Shift

## Description
Write test for i32 >> amount arithmetic right shift operation in C-Next.

## Test Category
Bitwise Operators

## Context Being Tested
Arithmetic right shift operation on i32 operand (sign bit preserved).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/bitwise-i32-arithmetic-rshift.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i32 >> amount (arithmetic)
- [ ] Jest test runner passes

## Test Implementation Notes
- Test right shift of i32 values including negative numbers
- Verify the transpiled C code correctly handles arithmetic right shift
- Signed types use arithmetic right shift (sign bit fill)
- Test with positive values (zero fill expected) and negative values (one fill expected)
- Example syntax:
  ```
  i32 positive <- 0x40000000;
  i32 r1 <- positive >> 4;  // Logical-like: 0x04000000

  i32 negative <- -16;  // 0xFFFFFFF0
  i32 r2 <- negative >> 2;  // Arithmetic: -4 (0xFFFFFFFC)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
