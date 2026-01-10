# Ticket: Literals - Float Literal Scientific Notation

## Description
Write test for float literal with scientific notation (e.g., 1e-5) in C-Next.

## Test Category
Literals - Float Literals

## Context Being Tested
Float literal with scientific/exponential notation used in variable initialization.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/literals/float-literal-scientific.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Scientific (1e-5) Variable init
- [ ] Jest test runner passes

## Test Implementation Notes
- Test assignment of scientific notation float literals to variables
- Include various scientific notation formats:
  - Small numbers (1e-5, 1e-10)
  - Large numbers (1e5, 1e10)
  - With decimal component (1.5e3, 2.5e-4)
  - Negative values (-1e5, -2.5e-3)
  - Uppercase E (1E5, 1E-5)
- Verify the transpiled C code correctly handles scientific notation
- Example syntax:
  ```
  f32 tiny <- 1e-5;
  f64 large <- 1e10;
  f32 combined <- 1.5e3;
  f64 precise <- 6.022e23;
  f32 negative <- -2.5e-4;
  ```

## Related Coverage
- Section 32.2 Float Literals in coverage.md
- Complements float-literal-decimal.md for complete float literal coverage

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
