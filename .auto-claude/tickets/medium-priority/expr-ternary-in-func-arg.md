# Ticket: Expression Contexts - Ternary in Function Argument

## Description
Write test for using ternary expressions as function arguments in C-Next.

## Test Category
Expression Contexts - Nested/Complex Expressions

## Context Being Tested
Using a ternary operator expression directly as an argument to a function call.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/ternary-in-func-arg.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Ternary in function arg"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that accepts a parameter
- Call the function with a ternary expression as the argument
- Example syntax: `someFunc((condition) ? value1 : value2);`
- Verify the correct branch value is passed to the function
- Test with different types (integers, booleans)
- Verify transpiled C code correctly evaluates the ternary before passing

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
