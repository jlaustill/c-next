# Ticket: Primitive Types - f64 In Comparison

## Description
Write test for f64 in comparison expressions in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Comparison operations (=, !=, <, >, <=, >=) with f64 operands.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-comparison.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 In comparison
- [ ] Jest test runner passes

## Test Implementation Notes
- Test equality, inequality, and relational comparisons with f64 values
- Verify the transpiled C code correctly handles double comparisons
- Example syntax:
  ```
  f64 a <- 3.14159265358979;
  f64 b <- 2.0;
  bool isEqual <- (a = b);
  bool isLess <- (a < b);
  bool isGreater <- (a > b);
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
