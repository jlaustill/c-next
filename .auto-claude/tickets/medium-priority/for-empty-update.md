# Ticket: Control Flow - for Loop with Empty Update

## Description
Write test for for loop with empty update expression in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Using a for loop where the update section is empty (update done in body).

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-empty-update.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for For with empty update
- [ ] Jest test runner passes

## Test Implementation Notes
- Create for loop with empty update section
- Perform update inside loop body
- Example:
  ```
  for (u32 i <- 0; i < 10;) {
      // loop body
      i +<- 1;  // update inside body
  }
  ```
- Verify correct C code generation with empty update

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
