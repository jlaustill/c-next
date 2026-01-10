# Ticket: Control Flow - for Non-boolean Condition Error

## Description
Write test for for loop with non-boolean condition (ERROR case) in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Ensuring the compiler rejects for loops with non-boolean conditions.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-error-nonbool.cnx`
- [ ] Test produces expected compiler error
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Non-boolean condition (ERROR)
- [ ] Jest test runner passes (error test should expect failure)

## Test Implementation Notes
- Attempt to use an integer as a for loop condition
- Example: `for (u32 i <- 0; i; i +<- 1) { ... }` should fail
- Example: `for (u32 i <- 0; 1; i +<- 1) { ... }` should fail
- Verify error message is clear and helpful
- C-Next requires explicit boolean conditions unlike C

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
