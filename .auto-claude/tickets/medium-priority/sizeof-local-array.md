# Ticket: sizeof Operator - Local Array

## Description
Write test for sizeof operator applied to a local array in C-Next.

## Test Category
sizeof Operator

## Context Being Tested
Using sizeof on a local array variable to get the total size of the array in bytes.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/sizeof/local-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for sizeof Local array
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a local array of known size
- Use sizeof on the array variable
- Verify the result is (element_count * element_size)
- Example syntax: `u32[10] arr; u32 size <- sizeof(arr);` should yield 40
- Verify transpiled C code correctly uses sizeof

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
