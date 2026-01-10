# Ticket: Arrays - Out of Bounds Error

## Description
Write test for array out of bounds compile-time error detection in C-Next.

## Test Category
Arrays

## Context Being Tested
Compiler detection and rejection of array access with indices that exceed the declared array size (compile-time bounds checking).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/arrays/array-bounds-error.cnx`
- [ ] Test correctly triggers compiler error (or fails if bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Out of bounds (ERROR)
- [ ] Jest test runner passes

## Test Implementation Notes
- This is an ERROR test - the compiler should reject the code
- Declare an array with a known size
- Attempt to access an element beyond the array bounds
- Example syntax:
  ```
  u32[5] values <- [1, 2, 3, 4, 5];
  u32 invalid <- values[5];  // ERROR: index 5 is out of bounds for array of size 5
  ```
- Also test negative indices if applicable
- Verify the compiler produces a clear error message about bounds violation
- Error test file naming convention: include "error" in the path

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
