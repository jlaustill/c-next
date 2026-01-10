# Ticket: Primitive Types - f32 Literal with Decimal

## Description
Write test for f32 literal with decimal notation in C-Next.

## Test Category
Primitive Types - Floating Point / Literals

## Context Being Tested
Float literal with decimal point assigned to f32 variable.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-literal-decimal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Literal with decimal
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of decimal literals to f32 variables
- Verify the transpiled C code correctly handles float literal notation
- Example syntax:
  ```
  f32 pi <- 3.14159;
  f32 half <- 0.5;
  f32 negativeValue <- -1.5;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
