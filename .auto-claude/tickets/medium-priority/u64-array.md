# Ticket: Primitive Types - u64 Array Element

## Description
Write test for u64 as array element type in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u64 as the element type for single-dimensional arrays.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 Array element type
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a 1D array with u64 element type
- Initialize with values and access elements
- Example syntax: `u64[4] bigNumbers <- [1000000000000, 2000000000000, 3000000000000, 4000000000000];`
- Verify transpiled C code uses `uint64_t` for array elements

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
