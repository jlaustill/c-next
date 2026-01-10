# Ticket: Strings - Array of Strings

## Description
Write test for arrays of string type in C-Next.

## Test Category
Strings

## Context Being Tested
Declaring and using arrays where each element is a string.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/string/string-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Strings - Array of strings
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare an array of strings with fixed capacity
- Initialize array elements with string literals
- Access individual strings via array index
- Example syntax: `string[16] names[4];` or `string[16][4] names;`
- Verify transpiled C code correctly handles array of strings
- Test iteration over string array in for loop
- Consider testing .length property on the outer array

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
