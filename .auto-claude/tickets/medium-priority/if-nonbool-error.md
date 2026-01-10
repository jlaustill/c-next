# Ticket: Control Flow - if Non-boolean Condition Error

## Description
Write test for if statement with non-boolean condition (ERROR case) in C-Next.

## Test Category
Control Flow - if Statement

## Context Being Tested
Ensuring the compiler rejects if statements with non-boolean conditions.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/control-flow/if-error-nonbool.cnx`
- [ ] Test produces expected compiler error
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Non-boolean condition (ERROR)
- [ ] Jest test runner passes (error test should expect failure)

## Test Implementation Notes
- Attempt to use an integer as an if condition
- Example: `if (42) { ... }` should fail
- Example: `if (someIntVar) { ... }` should fail
- Verify error message is clear and helpful
- C-Next requires explicit boolean conditions unlike C

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
