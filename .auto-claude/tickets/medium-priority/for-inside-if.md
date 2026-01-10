# Ticket: Control Flow - for Loop Inside if

## Description
Write test for for loop inside if statement in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Using a for loop inside an if statement block.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-inside-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for For inside if
- [ ] Jest test runner passes

## Test Implementation Notes
- Create an if statement containing a for loop
- Test in both if branch and else branch
- Example:
  ```
  if (condition) {
      for (u32 i <- 0; i < 5; i +<- 1) {
          // loop body
      }
  }
  ```
- Verify correct C code generation with proper scoping

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
