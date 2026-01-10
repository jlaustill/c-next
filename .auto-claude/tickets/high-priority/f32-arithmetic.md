# Ticket: Primitive Types - f32 In Arithmetic Expression

## Description
Write test for f32 in arithmetic expressions in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Arithmetic operations (+, -, *, /) with f32 operands.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-arithmetic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 In arithmetic expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Test addition, subtraction, multiplication, and division with f32 values
- Verify the transpiled C code correctly handles float arithmetic
- Example syntax:
  ```
  f32 a <- 3.14;
  f32 b <- 2.0;
  f32 sum <- a + b;
  f32 diff <- a - b;
  f32 product <- a * b;
  f32 quotient <- a / b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
