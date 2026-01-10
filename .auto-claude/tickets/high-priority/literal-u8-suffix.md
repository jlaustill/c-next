# Ticket: Literals - Integer with u8 Suffix

## Description
Write test for integer literal with explicit u8 suffix in C-Next.

## Test Category
Literals - Integer Literals

## Context Being Tested
Integer literal with explicit u8 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/integer-u8-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With u8 suffix"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of integer literals with explicit u8 suffix
- Verify the transpiled C code correctly handles the type suffix notation
- Test various valid u8 values (0-255 range)
- Example syntax:
  ```
  u8 value <- 42u8;
  u8 max <- 255u8;
  u8 zero <- 0u8;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
