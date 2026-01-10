# Ticket: Initialization - Partial Branch Init (ERROR)

## Description
Write test that verifies C-Next produces an error when a variable is only initialized in some branches.

## Test Category
Initialization

## Context Being Tested
Verifying the compiler detects and reports an error when a variable is initialized in only some code paths, leaving it potentially uninitialized.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/initialization/partial-branch-init-error.cnx`
- [ ] Test correctly triggers a compiler error
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Partial branch init (ERROR)
- [ ] Jest test runner passes (error test passes)

## Test Implementation Notes
- Declare a variable before an if statement
- Initialize the variable in only the if branch (not the else)
- Attempt to use the variable after the if statement
- Compiler should report "use before initialization" or similar error
- Example: `u32 x; if (cond) { x <- 5; } return x;` - error because else path doesn't init

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
