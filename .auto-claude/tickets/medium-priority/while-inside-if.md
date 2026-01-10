# Ticket: Control Flow - while Loop Inside if

## Description
Write test for while loop inside if statement in C-Next.

## Test Category
Control Flow - while Loop

## Context Being Tested
Using a while loop inside an if statement block.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/control-flow/while-inside-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for While inside if
- [ ] Jest test runner passes

## Test Implementation Notes
- Create an if statement containing a while loop
- Test both if branch and else branch with while loops
- Example:
  ```
  if (condition) {
      u32 i <- 0;
      while (i < 5) {
          // loop body
          i +<- 1;
      }
  }
  ```
- Verify correct C code generation with proper scoping

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
