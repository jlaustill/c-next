# Ticket: sizeof Operator - In Array Size

## Description
Write test for sizeof operator used to determine array size in C-Next.

## Test Category
sizeof Operator

## Context Being Tested
Using sizeof in the array size specifier or to calculate the number of elements.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/sizeof/in-array-size.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for sizeof In array size
- [ ] Jest test runner passes

## Test Implementation Notes
- Use sizeof to calculate number of elements in an array
- Example: `u32 count <- sizeof(arr) / sizeof(arr[0]);`
- This is a common C idiom for getting array length at compile time
- Verify transpiled C code correctly uses sizeof in this context

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
