# Ticket: Control Flow - for Loop with Empty Condition

## Description
Write test for for loop with empty condition (infinite loop) in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Using a for loop where the condition section is empty (creates infinite loop).

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-empty-condition.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for For with empty condition
- [ ] Jest test runner passes

## Test Implementation Notes
- Create for loop with empty condition (infinite loop)
- Include a way to break out for test completion
- Example:
  ```
  for (u32 i <- 0; ; i +<- 1) {
      if (i >= 10) {
          return;
      }
  }
  ```
- Verify correct C code generation with `for(;;)` pattern

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
