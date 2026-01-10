# Ticket: References - Reference in Loop

## Description
Write test for using reference parameters within loops in C-Next.

## Test Category
References (Pass-by-reference)

## Context Being Tested
Modifying a reference parameter inside a loop iteration, such as accumulating values or iteratively updating data.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/references/ref-in-loop.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Ref in loop
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a function that takes a reference parameter
- Inside the function, use a loop (for/while) that modifies the reference
- Example: accumulator function that sums array elements into a ref parameter
- Example syntax: `fn sumArray(u32[5] arr, ref u32 total) -> void { for (u32 i <- 0; i < 5; i +<- 1) { total +<- arr[i]; } }`
- Test with different loop types (for, while, do-while)
- Verify transpiled C code correctly handles reference modification in loop body

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
