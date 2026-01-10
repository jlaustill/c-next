# Ticket: Literals - Integer with u16 Suffix

## Description
Write test for integer literal with explicit u16 suffix in C-Next.

## Test Category
Literals - Integer Literals

## Context Being Tested
Integer literal with explicit u16 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/integer-u16-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With u16 suffix"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of integer literals with explicit u16 suffix
- Verify the transpiled C code correctly handles the type suffix notation
- Test various valid u16 values (0-65535 range)
- Example syntax:
  ```
  u16 value <- 1000u16;
  u16 max <- 65535u16;
  u16 zero <- 0u16;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
