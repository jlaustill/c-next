# Ticket: Logical Operators - ! in Ternary Condition

## Description
Write test for logical NOT (!) used in ternary operator conditions in C-Next.

## Test Category
Logical Operators - NOT (!)

## Context Being Tested
Using the ! operator in a ternary operator's condition expression.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/logical/logical-not-in-ternary.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "In ternary condition" under 6.3 NOT (!)
- [ ] Jest test runner passes

## Test Implementation Notes
- Use ! operator in the condition of a ternary expression
- Example syntax: `u32 result <- (!flag) ? 1 : 0;`
- Test with boolean variables and comparison results
- Verify transpiled C code correctly handles negation in ternary conditions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
