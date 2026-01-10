# Ticket: Primitive Types - i8 Array Element

## Description
Write test for i8 as array element type in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i8 as the element type for single-dimensional arrays.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i8-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 Array element type
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a 1D array with i8 element type
- Initialize with values including negative numbers and access elements
- Example syntax: `i8[4] signedBytes <- [-128, -1, 0, 127];`
- Verify transpiled C code uses `int8_t` for array elements

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
