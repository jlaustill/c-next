# Ticket: Primitive Types - i8 in Comparison

## Description
Write test for i8 in comparison operations in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using i8 values in comparison operations (=, !=, <, >, <=, >=).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i8-comparison.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 In comparison
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i8 variables and perform comparison operations
- Test equality, inequality, less than, greater than, etc.
- Example syntax: `bool result <- a < b;`
- Include comparisons with negative values
- Verify transpiled C code correctly handles int8_t comparisons

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
