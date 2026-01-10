# Ticket: Primitive Types - u64 in Arithmetic Expression

## Description
Write test for u64 in arithmetic expressions in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u64 values in arithmetic operations (+, -, *, /, %).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-arithmetic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 In arithmetic expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare u64 variables and perform arithmetic operations
- Test addition, subtraction, multiplication, division, and modulo
- Example syntax: `u64 result <- a + b;`
- Use large values that require 64-bit representation
- Verify transpiled C code correctly handles uint64_t arithmetic

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
