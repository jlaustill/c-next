# Ticket: Primitive Types - i16 Arithmetic Expression

## Description
Write test for i16 in arithmetic expressions in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i16 values in arithmetic operations (addition, subtraction, multiplication, division, modulo).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i16-arithmetic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 In arithmetic expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i16 variables and perform arithmetic operations
- Test addition: `i16 sum <- a + b;`
- Test subtraction: `i16 diff <- a - b;`
- Test multiplication: `i16 prod <- a * b;`
- Test division: `i16 quot <- a / b;`
- Test modulo: `i16 rem <- a % b;`
- Include operations with negative values
- Verify transpiled C code uses `int16_t` and correct operators

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
