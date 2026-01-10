# Ticket: Literals - Float Literal Decimal

## Description
Write test for float literal with decimal notation (e.g., 3.14) in C-Next.

## Test Category
Literals - Float Literals

## Context Being Tested
Float literal with decimal point notation used in variable initialization.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/float-literal-decimal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Decimal (3.14) Variable init
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of decimal float literals to variables
- Include various decimal formats:
  - Simple decimals (3.14, 0.5, 1.0)
  - Negative decimals (-1.5, -0.25)
  - Leading zero (0.123)
  - No leading zero might not be valid - check grammar
- Verify the transpiled C code correctly handles float literal notation
- Example syntax:
  ```
  f32 pi <- 3.14159;
  f64 precise <- 3.141592653589793;
  f32 half <- 0.5;
  f32 negative <- -2.5;
  ```

## Related Coverage
- Section 32.2 Float Literals in coverage.md
- Also see: f32-literal-decimal.md and f64-literal-decimal.md for type-specific tests

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
