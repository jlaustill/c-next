# Ticket: Volatile Modifier - Local Variable

## Description
Write test for volatile modifier on local variable declarations in C-Next.

## Test Category
Modifiers - Volatile

## Context Being Tested
Using the volatile modifier on local variable declarations within functions.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/modifiers/volatile-local.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for volatile Local variable
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a local variable with the volatile modifier inside a function
- Test with different types (u32, u8, etc.)
- Example syntax: `volatile u32 localFlag <- 0;`
- Verify transpiled C code includes the `volatile` keyword in the correct position
- Local volatile variables are less common but valid for signal handlers, longjmp contexts, etc.

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
