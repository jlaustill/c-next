# Ticket: Ternary Operator - With Function Calls as Values

## Description
Write test for ternary expressions that have function calls as their branch values in C-Next.

## Test Category
Ternary Operator

## Context Being Tested
Using function call results as the true and/or false branches of a ternary expression.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/ternary/ternary-with-function-calls.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "With function calls as values"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define functions that return values
- Use function calls as the branch values in ternary expressions
- Example syntax: `u32 result <- (condition) ? getValueA() : getValueB();`
- Verify transpiled C code correctly evaluates the function calls
- Test that only the selected branch's function is called (short-circuit behavior)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
