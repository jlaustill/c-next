# Ticket: Primitive Types - i64 Negative Literal Assignment

## Description
Write test for i64 negative literal assignment in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Assigning negative literal values to i64 variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i64-negative-literal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 Negative literal assignment
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i64 variables with negative literal values
- Example syntax: `i64 negVal <- -1000000000000;`
- Test edge cases like minimum i64 value: `i64 minVal <- -9223372036854775808;`
- Test unary negation of positive values
- Verify transpiled C code handles int64_t negative literals correctly (may need LL suffix)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
