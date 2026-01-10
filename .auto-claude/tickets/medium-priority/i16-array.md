# Ticket: Primitive Types - i16 Array Element

## Description
Write test for i16 as array element type in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i16 as the element type for single-dimensional arrays.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i16-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 Array element type
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a 1D array with i16 element type
- Initialize with values including negative numbers and access elements
- Example syntax: `i16[4] signedShorts <- [-32768, -1, 0, 32767];`
- Verify transpiled C code uses `int16_t` for array elements

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
