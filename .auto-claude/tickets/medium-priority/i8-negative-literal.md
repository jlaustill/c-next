# Ticket: Primitive Types - i8 Negative Literal Assignment

## Description
Write test for i8 negative literal assignment in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Assigning negative literal values directly to i8 variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i8-negative-literal.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 Negative literal assignment
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare i8 variables with negative literal initializations
- Test various negative values within i8 range (-128 to -1)
- Example syntax: `i8 negValue <- -42;`
- Test minimum value: `i8 minVal <- -128;`
- Verify transpiled C code correctly represents negative literals

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
