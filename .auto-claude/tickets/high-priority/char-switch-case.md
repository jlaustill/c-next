# Ticket: Literals - Character in Switch Case

## Description
Write test for character literal in switch case in C-Next.

## Test Category
Literals - Character Literals

## Context Being Tested
Using character literals as case values in a switch statement.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/char-switch-case.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Character literal In switch case
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a switch statement with character literal case values
- Verify the transpiled C code correctly handles char cases in switch
- Example syntax:
  ```
  switch (ch) {
      case 'a': { ... }
      case 'b': { ... }
      default: { ... }
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
