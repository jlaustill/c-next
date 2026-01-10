# Ticket: Literals - Character Comparison

## Description
Write test for character literal comparison in C-Next.

## Test Category
Literals - Character Literals

## Context Being Tested
Comparing a variable or value against a character literal.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/char-comparison.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Character literal Comparison
- [ ] Jest test runner passes

## Test Implementation Notes
- Compare a variable against a character literal using equality and relational operators
- Verify the transpiled C code correctly handles char comparisons
- Example syntax: `if (ch = 'Y') { ... }` or `if (ch < 'z') { ... }`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
