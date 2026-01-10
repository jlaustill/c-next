# Ticket: Control Flow - for Loop with Compound Update

## Description
Write test for for loop with compound update expression in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Using compound assignment operators in the update part of a for loop.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-compound-update.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for For with compound update
- [ ] Jest test runner passes

## Test Implementation Notes
- Use compound assignment in for loop update
- Test with different compound operators (+<-, -<-, *<-)
- Example:
  ```
  for (u32 i <- 0; i < 10; i +<- 2) {
      // loop body, steps by 2
  }
  ```
- Verify correct C code generation with proper operator translation

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
