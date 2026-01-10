# Ticket: Literals - Integer with i16 Suffix

## Description
Write test for integer literal with explicit i16 suffix in C-Next.

## Test Category
Literals - Integer Literals

## Context Being Tested
Integer literal with explicit i16 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/integer-i16-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With i16 suffix"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of integer literals with explicit i16 suffix
- Verify the transpiled C code correctly handles the type suffix notation
- Test various valid i16 values (-32768 to 32767 range)
- Include both positive and negative values
- Example syntax:
  ```
  i16 value <- 1000i16;
  i16 negative <- -5000i16;
  i16 max <- 32767i16;
  i16 min <- -32768i16;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
