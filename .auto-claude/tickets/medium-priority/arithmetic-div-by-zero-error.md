# Ticket: Arithmetic Operators - Division by Zero Error

## Description
Write test for division by zero error handling in C-Next.

## Test Category
Arithmetic Operators - Error Handling

## Context Being Tested
Compiler error detection and reporting for division by zero.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/operators/arithmetic-div-by-zero-error.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Division by zero (ERROR)
- [ ] Jest test runner passes

## Test Implementation Notes
- This is an ERROR test - it should verify the compiler correctly detects division by zero
- Test with literal zero divisor (should be caught at compile time)
- May also test with constant expressions that evaluate to zero
- Verify appropriate error message is generated
- Example syntax (should produce error):
  ```
  u32 a <- 100;
  u32 result <- a / 0;  // ERROR: division by zero
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
