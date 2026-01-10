# Ticket: Logical Operators - && as Standalone Expression

## Description
Write test for logical AND (&&) used as a standalone expression in C-Next.

## Test Category
Logical Operators - AND (&&)

## Context Being Tested
Using && as a standalone expression assigned to a boolean variable, not just in control flow conditions.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/logical/logical-and-standalone.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "As standalone expression" under 6.1 AND (&&)
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare boolean variables and use && outside of if/while/for conditions
- Example syntax: `bool result <- (a > 5) && (b < 10);`
- Test assignment of && result to a variable
- Verify transpiled C code correctly handles standalone logical AND expressions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
