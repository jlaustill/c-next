# Ticket: Literals - Integer with i32 Suffix

## Description
Write test for integer literal with explicit i32 suffix in C-Next.

## Test Category
Literals - Integer Literals

## Context Being Tested
Integer literal with explicit i32 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/integer-i32-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With i32 suffix"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of integer literals with explicit i32 suffix
- Verify the transpiled C code correctly handles the type suffix notation
- Test various valid i32 values (-2147483648 to 2147483647 range)
- Include both positive and negative values
- Example syntax:
  ```
  i32 value <- 100000i32;
  i32 negative <- -500000i32;
  i32 max <- 2147483647i32;
  i32 min <- -2147483648i32;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
