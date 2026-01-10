# Ticket: Primitive Types - i32 Array Element

## Description
Write test for i32 as array element type in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i32 as the element type for single-dimensional arrays.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i32-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i32 Array element type
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a 1D array with i32 element type
- Initialize with values including negative numbers and access elements
- Example syntax: `i32[4] signedInts <- [-2147483648, -1, 0, 2147483647];`
- Verify transpiled C code uses `int32_t` for array elements

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
