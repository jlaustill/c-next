# Ticket: Control Flow - Switch Inside Loop

## Description
Write test for switch statement placed inside a loop in C-Next.

## Test Category
Control Flow - Switch Statement

## Context Being Tested
Switch statement nested within a for, while, or do-while loop.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/switch/switch-inside-loop.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Switch inside loop
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a switch statement inside a for loop (and/or while loop)
- The switch value should change each iteration
- Test that different cases execute on different iterations
- Example syntax:
  ```
  for (u32 i <- 0; i < 5; i <- i + 1) {
      switch (i % 3) {
          case 0: { // handle divisible by 3 }
          case 1: { // handle remainder 1 }
          case 2: { // handle remainder 2 }
      }
  }
  ```
- Verify transpiled C code correctly handles switch within loop scoping

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
