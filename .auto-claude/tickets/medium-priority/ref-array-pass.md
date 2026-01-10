# Ticket: References - Array Pass by Reference

## Description
Write test for passing arrays by reference in C-Next.

## Test Category
References (Pass-by-reference)

## Context Being Tested
Passing an array as a reference parameter to a function, allowing the function to modify the array contents.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/references/array-pass-by-ref.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Array pass by ref
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a function that takes an array by reference
- Modify array elements within the function
- Verify modifications persist after function returns
- Example syntax: `fn modifyArray(ref u32[5] arr) -> void { arr[0] <- 100; }`
- Test with various array types (u8, u32, etc.)
- Verify transpiled C code passes array pointer correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
