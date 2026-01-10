# Ticket: Primitive Types - f64 Literal with Decimal

## Description
Write test for f64 literal with decimal notation in C-Next.

## Test Category
Primitive Types - Floating Point / Literals

## Context Being Tested
Float literal with decimal point assigned to f64 variable.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-literal-decimal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Literal with decimal
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of decimal literals to f64 variables
- Verify the transpiled C code correctly handles double literal notation
- Example syntax:
  ```
  f64 pi <- 3.14159265358979;
  f64 half <- 0.5;
  f64 negativeValue <- -1.5;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
