# Ticket: Control Flow - Nested while Loop

## Description
Write test for nested while loops in C-Next.

## Test Category
Control Flow - while Loop

## Context Being Tested
Using while loops inside other while loops.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/control-flow/while-nested.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Nested while
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a while loop inside another while loop
- Use separate counters for outer and inner loops
- Example:
  ```
  u32 i <- 0;
  while (i < 3) {
      u32 j <- 0;
      while (j < 3) {
          // inner loop body
          j +<- 1;
      }
      i +<- 1;
  }
  ```
- Verify correct C code generation

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
