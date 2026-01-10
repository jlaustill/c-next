# Ticket: Control Flow - Critical Block Inside Loop

## Description
Write test for critical block placed inside a loop in C-Next.

## Test Category
Control Flow - Critical Block

## Context Being Tested
Critical block nested within a for, while, or do-while loop.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/critical/critical-in-loop.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Critical in loop
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a critical block inside a loop
- The critical block should protect atomic operations on each iteration
- Example syntax:
  ```
  atomic u32 counter;

  for (u32 i <- 0; i < 10; i <- i + 1) {
      critical (counter) {
          counter +<- 1;
      }
  }
  ```
- Verify transpiled C code correctly handles critical section entry/exit on each iteration
- Test with for loop and while loop variations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
