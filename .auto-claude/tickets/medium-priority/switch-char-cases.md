# Ticket: Control Flow - Switch with Character Literal Cases

## Description
Write test for switch statements with character literal case values in C-Next.

## Test Category
Control Flow - Switch Statement

## Context Being Tested
Using character literals ('a', 'b', etc.) as case values in switch statements.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/switch/switch-char-cases.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Char literal cases
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a switch statement with character literal case values
- Test common patterns like parsing commands or handling keyboard input
- Example syntax:
  ```
  switch (inputChar) {
      case 'a': { // handle 'a' }
      case 'b': { // handle 'b' }
      case '\n': { // handle newline escape sequence }
      default(252): { // handle other ASCII values }
  }
  ```
- Verify transpiled C code correctly handles char literals in case labels

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
