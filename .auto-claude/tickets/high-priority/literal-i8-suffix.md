# Ticket: Literals - Integer with i8 Suffix

## Description
Write test for integer literal with explicit i8 suffix in C-Next.

## Test Category
Literals - Integer Literals

## Context Being Tested
Integer literal with explicit i8 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/integer-i8-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With i8 suffix"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of integer literals with explicit i8 suffix
- Verify the transpiled C code correctly handles the type suffix notation
- Test various valid i8 values (-128 to 127 range)
- Include both positive and negative values
- Example syntax:
  ```
  i8 value <- 42i8;
  i8 negative <- -100i8;
  i8 max <- 127i8;
  i8 min <- -128i8;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
