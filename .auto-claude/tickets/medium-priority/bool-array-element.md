# Ticket: Primitive Types - Boolean Array Element

## Description
Write test for bool as an array element type in C-Next.

## Test Category
Primitive Types - Boolean

## Context Being Tested
Using bool as the element type for arrays.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/bool-array-element.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Boolean Array element type
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare an array with bool element type
- Initialize with true/false values and access elements
- Example syntax: `bool[4] flags <- [true, false, true, false];`
- Verify transpiled C code uses `bool` or `_Bool` for array elements

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
