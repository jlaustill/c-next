# Ticket: Initialization - Loop Init

## Description
Write test for variable initialization inside a loop in C-Next.

## Test Category
Initialization

## Context Being Tested
Verifying that variables initialized inside a loop are properly tracked for definite assignment.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/initialization/loop-init.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Loop init
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a variable before a loop
- Initialize the variable inside the loop body
- Use the variable after the loop (should be valid if loop always executes)
- Consider both for and while loop variants
- Example: declaring uninitialized, then assigning in loop body

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
