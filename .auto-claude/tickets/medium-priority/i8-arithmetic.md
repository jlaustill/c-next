# Ticket: Primitive Types - i8 in Arithmetic Expression

## Description
Write test for i8 in arithmetic expressions in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i8 values in arithmetic operations (+, -, *, /, %).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i8-arithmetic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 In arithmetic expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i8 variables and perform arithmetic operations
- Test addition, subtraction, multiplication, division, and modulo
- Example syntax: `i8 result <- a + b;`
- Include tests with negative values
- Verify transpiled C code correctly handles int8_t arithmetic

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
