# Ticket: Comments - Comment in Expression

## Description
Write test for comments appearing within expressions in C-Next.

## Test Category
Comments

## Context Being Tested
Comments (line or block) placed within the middle of expressions.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/comments/comment-in-expression.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Comment in expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Test line comments within expressions where valid
- Test block comments within expressions
- Example syntax:
  ```
  u32 result <- value1 /* inline comment */ + value2;
  u32 total <- a + /* middle */ b + c;
  ```
- Verify comments are properly stripped and don't affect expression parsing
- Test both single-line and multi-line block comments in expressions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
