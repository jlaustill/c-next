# Ticket: Primitive Types - i64 Arithmetic Expression

## Description
Write test for i64 in arithmetic expressions in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i64 values in arithmetic operations (addition, subtraction, multiplication, division, modulo).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i64-arithmetic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 In arithmetic expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i64 variables and perform arithmetic operations
- Test addition: `i64 sum <- a + b;`
- Test subtraction: `i64 diff <- a - b;`
- Test multiplication: `i64 prod <- a * b;`
- Test division: `i64 quot <- a / b;`
- Test modulo: `i64 rem <- a % b;`
- Include tests with negative values
- Verify transpiled C code uses `int64_t` types correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
