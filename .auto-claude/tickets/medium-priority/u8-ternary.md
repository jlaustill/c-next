# Ticket: Primitive Types - u8 in Ternary Expression

## Description
Write test for u8 in ternary expressions in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u8 values as the result branches of ternary expressions.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u8-ternary.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 In ternary expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Use u8 values in both branches of a ternary expression
- Assign the result to a u8 variable
- Example syntax: `u8 result <- (condition) ? value1 : value2;`
- Verify transpiled C code maintains u8 type throughout

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
