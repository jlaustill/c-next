# Ticket: Primitive Types - u16 as Loop Counter

## Description
Write test for u16 as loop counter variable in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u16 as the counter variable in for loops, particularly for medium iteration counts.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u16-loop-counter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 As loop counter
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a for loop with u16 counter type
- Iterate a number of times (within u16 range 0-65535)
- Example syntax: `for (u16 i <- 0; i < 1000; i +<- 1) { ... }`
- Verify transpiled C code uses `uint16_t` for loop counter

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
