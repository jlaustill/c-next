# Ticket: Primitive Types - u16 in Ternary Expression

## Description
Write test for u16 in ternary expressions in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u16 values as the result branches of ternary expressions.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u16-ternary.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 In ternary expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Use u16 values in both branches of a ternary expression
- Assign the result to a u16 variable
- Example syntax: `u16 result <- (condition) ? value1 : value2;`
- Verify transpiled C code maintains u16 type throughout

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
