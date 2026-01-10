# Ticket: Literals - Character Array Element

## Description
Write test for character literal as array element in C-Next.

## Test Category
Literals - Character Literals

## Context Being Tested
Character literal used as an element in an array or array initialization.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/char-array-element.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Character literal Array element
- [ ] Jest test runner passes

## Test Implementation Notes
- Create an array with character literal elements
- Verify the transpiled C code correctly handles char arrays
- Example syntax: `u8[3] vowels <- ['a', 'e', 'i'];`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
