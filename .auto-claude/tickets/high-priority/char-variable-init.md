# Ticket: Literals - Character Variable Initialization

## Description
Write test for character literal variable initialization in C-Next.

## Test Category
Literals - Character Literals

## Context Being Tested
Variable initialization with a character literal value.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/char-variable-init.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Character literal Variable init
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a variable and initialize it with a character literal
- Verify the transpiled C code correctly uses char type and literal
- Example syntax: `u8 letter <- 'A';`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
