# Ticket: Control Flow - for Loop with Multiple Init

## Description
Write test for for loop with multiple initialization expressions in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Using multiple variable initializations in the init part of a for loop.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-multiple-init.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for For with multiple init
- [ ] Jest test runner passes

## Test Implementation Notes
- Initialize multiple variables in for loop init section
- Example (if syntax supports):
  ```
  for (u32 i <- 0, u32 j <- 10; i < j; i +<- 1) {
      // loop body
  }
  ```
- Note: May need to verify if C-Next grammar supports this
- If not supported, document as unsupported syntax

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
