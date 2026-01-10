# Ticket: Arithmetic Operators - u64 Subtraction

## Description
Write test for u64 - u64 subtraction operation in C-Next.

## Test Category
Arithmetic Operators

## Context Being Tested
Subtraction operation between two u64 operands.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/arithmetic-u64-sub.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 - u64
- [ ] Jest test runner passes

## Test Implementation Notes
- Test basic subtraction of two u64 values
- Verify the transpiled C code correctly handles u64 arithmetic
- Test with large values that require 64-bit precision
- Be aware of potential underflow behavior with unsigned types
- Example syntax:
  ```
  u64 a <- 1000000000;
  u64 b <- 500000000;
  u64 diff <- a - b;
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
