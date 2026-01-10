# Ticket: Expression Contexts - 3+ Levels of Nesting

## Description
Write test for deeply nested statement blocks (3 or more levels) in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
3+ levels of nesting - verifying the transpiler correctly handles deeply nested control flow statements.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/nesting/deep-nesting-3plus.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "3+ levels of nesting"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test various combinations of deeply nested control flow:
  - `if` inside `if` inside `if` (3 levels)
  - `for` inside `while` inside `if` (mixed 3 levels)
  - `switch` inside `for` inside `while` (3 levels)
  - Even deeper nesting (4+ levels) if desired
- Verify proper variable scoping at each nesting level
- Test that break/return work correctly from deep nesting
- Example syntax:
  ```
  if (a > 0) {
      for (u32 i <- 0; i < 10; i +<- 1) {
          while (x < max) {
              // 3 levels deep
              if (condition) {
                  // 4 levels deep
              }
          }
      }
  }
  ```
- This tests the transpiler's ability to maintain proper C code generation with complex nesting

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
