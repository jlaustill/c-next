# Ticket: Primitive Types - i16 Comparison

## Description
Write test for i16 in comparison operations in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i16 values in comparison operations (less than, greater than, equality, etc.).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i16-comparison.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 In comparison
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i16 variables and perform comparison operations
- Test less than: `if (a < b) { ... }`
- Test greater than: `if (a > b) { ... }`
- Test less than or equal: `if (a <= b) { ... }`
- Test greater than or equal: `if (a >= b) { ... }`
- Test equality: `if (a = b) { ... }`
- Test inequality: `if (a != b) { ... }`
- Include comparisons with negative values
- Verify transpiled C code uses correct comparison operators

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
