# Ticket: Control Flow - for Loop with Empty Init

## Description
Write test for for loop with empty initialization in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Using a for loop where the init section is empty (variable declared before loop).

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-empty-init.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for For with empty init
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare loop variable before the for loop
- Leave init section empty
- Example:
  ```
  u32 i <- 0;
  for (; i < 10; i +<- 1) {
      // loop body
  }
  ```
- Verify correct C code generation with empty init

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
