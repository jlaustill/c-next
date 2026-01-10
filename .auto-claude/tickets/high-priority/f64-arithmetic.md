# Ticket: Primitive Types - f64 In Arithmetic Expression

## Description
Write test for f64 in arithmetic expressions in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Arithmetic operations (+, -, *, /) with f64 operands.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-arithmetic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 In arithmetic expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Test addition, subtraction, multiplication, and division with f64 values
- Verify the transpiled C code correctly handles double arithmetic
- Example syntax:
  ```
  f64 a <- 3.14159265358979;
  f64 b <- 2.0;
  f64 sum <- a + b;
  f64 diff <- a - b;
  f64 product <- a * b;
  f64 quotient <- a / b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
