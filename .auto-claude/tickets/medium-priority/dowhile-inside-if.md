# Ticket: Control Flow - do-while Loop Inside if

## Description
Write test for do-while loop inside if statement in C-Next.

## Test Category
Control Flow - do-while Loop

## Context Being Tested
Using a do-while loop inside an if statement block.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/do-while/dowhile-inside-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for do-while inside if
- [ ] Jest test runner passes

## Test Implementation Notes
- Create an if statement containing a do-while loop
- Test in both if branch and else branch
- Example:
  ```
  if (condition) {
      u32 i <- 0;
      do {
          // loop body
          i +<- 1;
      } while (i < 5);
  }
  ```
- Verify correct C code generation with proper scoping

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
