# Ticket: Literals - Character Escape Sequences

## Description
Write test for character literal escape sequences in C-Next.

## Test Category
Literals - Character Literals

## Context Being Tested
Character literals with escape sequences like newline, tab, backslash, etc.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/char-escape-sequences.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Character literal Escape sequences
- [ ] Jest test runner passes

## Test Implementation Notes
- Test various escape sequences in character literals
- Common escape sequences to test: `'\n'` (newline), `'\t'` (tab), `'\\'` (backslash), `'\''` (single quote), `'\0'` (null)
- Verify the transpiled C code correctly handles escape sequences
- Example syntax: `u8 newline <- '\n';`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
