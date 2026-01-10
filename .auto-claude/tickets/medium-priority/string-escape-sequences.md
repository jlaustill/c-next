# Ticket: Literals - String Escape Sequences

## Description
Write test for escape sequences in string literals in C-Next.

## Test Category
Literals - String Literals

## Context Being Tested
Using escape sequences within string literals (newline, tab, backslash, quotes, etc.).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/string/string-escape-sequences.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Escape sequences under String Literals
- [ ] Jest test runner passes

## Test Implementation Notes
- Test common escape sequences in string literals:
  - `\n` - newline
  - `\t` - tab
  - `\\` - backslash
  - `\"` - double quote
  - `\r` - carriage return
  - `\0` - null character
- Example syntax:
  ```
  string<32> message <- "Hello\nWorld";
  string<16> path <- "C:\\temp";
  string<24> quote <- "She said \"Hi\"";
  ```
- Verify the transpiled C code preserves escape sequences correctly
- Test string.length with escape sequences (escape is single character)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
