# Ticket: Primitive Types - i64 Comparison

## Description
Write test for i64 in comparison operations in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i64 values in comparison operations (=, !=, <, >, <=, >=).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i64-comparison.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 In comparison
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i64 variables and perform comparison operations
- Test equality: `if (a = b) { ... }`
- Test inequality: `if (a != b) { ... }`
- Test less than: `if (a < b) { ... }`
- Test greater than: `if (a > b) { ... }`
- Test less than or equal: `if (a <= b) { ... }`
- Test greater than or equal: `if (a >= b) { ... }`
- Include tests with negative values
- Verify transpiled C code generates correct comparisons for int64_t

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
