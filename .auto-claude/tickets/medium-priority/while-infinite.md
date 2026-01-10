# Ticket: Control Flow - Infinite while Loop

## Description
Write test for infinite while loop with `while (true)` in C-Next.

## Test Category
Control Flow - while Loop

## Context Being Tested
Using `while (true)` for intentional infinite loops (common in embedded systems).

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/control-flow/while-infinite.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Infinite while (while true)
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a while loop with boolean literal `true`
- Include a way to break out (return or break) to allow test completion
- Example:
  ```
  while (true) {
      // main loop body
      if (shouldExit) {
          return;
      }
  }
  ```
- This pattern is common in embedded main loops
- Verify `while (true)` generates `while (1)` or `while (true)` in C

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
