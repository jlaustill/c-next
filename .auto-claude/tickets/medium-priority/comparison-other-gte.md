# Ticket: Comparison Operators - Other Types >=

## Description
Write test for greater-than-or-equal comparison with non-u32/i32 types in C-Next.

## Test Category
Comparison Operators

## Context Being Tested
Greater-than-or-equal comparison for types other than u32 and i32 (which are already covered).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/comparison/other-types-gte.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Other types >=
- [ ] Jest test runner passes

## Test Implementation Notes
- Test greater-than-or-equal comparison for various types:
  - u8 >= u8
  - u16 >= u16
  - u64 >= u64
  - i8 >= i8
  - i16 >= i16
  - i64 >= i64
- Test both true and false cases
- Test equality case (a >= a should be true)
- Example syntax:
  ```
  u8 a <- 20;
  u8 b <- 10;
  u8 c <- 20;
  bool gte1 <- (a >= b);  // true
  bool gte2 <- (b >= a);  // false
  bool gte3 <- (a >= c);  // true (equal)
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
