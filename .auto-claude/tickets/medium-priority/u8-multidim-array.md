# Ticket: Primitive Types - u8 Multi-dimensional Array Element

## Description
Write test for u8 as multi-dimensional array element type in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u8 as the element type for multi-dimensional arrays (2D, 3D, etc.).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u8-multidim-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 Array element type (multi-dim)
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a 2D array with u8 element type
- Initialize with values and access elements
- Example syntax: `u8[3][4] matrix <- [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]];`
- Verify transpiled C code uses `uint8_t` for array elements

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
