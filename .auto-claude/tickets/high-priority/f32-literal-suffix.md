# Ticket: Primitive Types - f32 Literal with f32 Suffix

## Description
Write test for f32 literal with explicit f32 suffix in C-Next.

## Test Category
Primitive Types - Floating Point / Literals

## Context Being Tested
Float literal with explicit f32 type suffix.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-literal-suffix.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Literal with f32 suffix
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of literals with explicit f32 suffix
- Verify the transpiled C code correctly handles the float suffix notation
- Example syntax:
  ```
  f32 value <- 3.14f32;
  f32 precise <- 1.0f32;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
