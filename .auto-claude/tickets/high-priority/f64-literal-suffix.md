# Ticket: Primitive Types - f64 Literal with f64 Suffix

## Description
Write test for f64 literal with explicit f64 suffix in C-Next.

## Test Category
Primitive Types - Floating Point / Literals

## Context Being Tested
Float literal with explicit f64 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-literal-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Literal with f64 suffix
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of literals with explicit f64 suffix
- Verify the transpiled C code correctly handles the double suffix notation
- Example syntax:
  ```
  f64 value <- 3.14159265358979f64;
  f64 precise <- 1.0f64;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
