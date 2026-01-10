# Ticket: Primitive Types - i64 Array Element

## Description
Write test for i64 as array element type in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i64 as the element type for single-dimensional arrays.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i64-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 Array element type
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a 1D array with i64 element type
- Initialize with values including negative numbers and access elements
- Example syntax: `i64[4] signedLongs <- [-9223372036854775808, -1, 0, 9223372036854775807];`
- Verify transpiled C code uses `int64_t` for array elements

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
