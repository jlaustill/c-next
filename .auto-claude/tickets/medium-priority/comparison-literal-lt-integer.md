# Ticket: Comparison Operators - Literal < Integer

## Description
Write test for literal less-than integer comparison in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Less-than comparison with a literal on the left side and an integer variable on the right.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/literal-lt-integer.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Literal < Integer
- [ ] Jest test runner passes

## Test Implementation Notes
- Test less-than comparison with literal on left side
- Test with different integer types (u32, i32)
- Test both true and false cases
- Example syntax:
  ```
  u32 a <- 20;
  u32 b <- 5;
  bool lt1 <- (10 < a);  // true (10 < 20)
  bool lt2 <- (10 < b);  // false (10 < 5)
  bool lt3 <- (10 < 10); // false (10 < 10 - if variable holds 10)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
