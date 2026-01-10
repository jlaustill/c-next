# Ticket: Literals - Integer with u32 Suffix

## Description
Write test for integer literal with explicit u32 suffix in C-Next.

## Test Category
Literals - Integer Literals

## Context Being Tested
Integer literal with explicit u32 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/integer-u32-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With u32 suffix"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of integer literals with explicit u32 suffix
- Verify the transpiled C code correctly handles the type suffix notation
- Test various valid u32 values (0-4294967295 range)
- Example syntax:
  ```
  u32 value <- 100000u32;
  u32 max <- 4294967295u32;
  u32 zero <- 0u32;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
