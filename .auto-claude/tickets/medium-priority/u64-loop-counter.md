# Ticket: Primitive Types - u64 as Loop Counter

## Description
Write test for u64 as loop counter in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u64 as the counter variable in for loops.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-loop-counter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 As loop counter
- [ ] Jest test runner passes

## Test Implementation Notes
- Use u64 as the loop counter variable in a for loop
- Example syntax: `for (u64 i <- 0; i < 10; i +<- 1) { ... }`
- Test iteration and counter increment/decrement
- Verify transpiled C code uses uint64_t for the loop variable

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
