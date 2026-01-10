# Ticket: Primitive Types - u8 as Loop Counter

## Description
Write test for u8 as loop counter variable in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u8 as the counter variable in for loops, particularly for small iteration counts.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u8-loop-counter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 As loop counter
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a for loop with u8 counter type
- Iterate a small number of times (within u8 range 0-255)
- Example syntax: `for (u8 i <- 0; i < 10; i +<- 1) { ... }`
- Verify transpiled C code uses `uint8_t` for loop counter

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
