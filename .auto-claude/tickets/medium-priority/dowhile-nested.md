# Ticket: Control Flow - Nested do-while Loop

## Description
Write test for nested do-while loops in C-Next.

## Test Category
Control Flow - do-while Loop

## Context Being Tested
Using do-while loops inside other do-while loops.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/do-while/dowhile-nested.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Nested do-while
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a do-while loop inside another do-while loop
- Use separate counters for outer and inner loops
- Example:
  ```
  u32 i <- 0;
  do {
      u32 j <- 0;
      do {
          // inner loop body
          j +<- 1;
      } while (j < 3);
      i +<- 1;
  } while (i < 3);
  ```
- Verify correct C code generation

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
