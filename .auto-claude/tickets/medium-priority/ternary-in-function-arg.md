# Ticket: Ternary Operator - In Function Argument

## Description
Write test for using ternary expressions as function arguments in C-Next.

## Test Category
Ternary Operator

## Context Being Tested
Using a ternary expression directly as an argument when calling a function.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/ternary/ternary-in-function-arg.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "In function argument"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that takes a parameter
- Call the function with a ternary expression as the argument
- Example syntax: `someFunction((condition) ? value1 : value2);`
- Verify transpiled C code correctly passes the ternary result to the function
- Test with both true and false conditions to ensure correct value is passed

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
