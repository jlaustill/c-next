# Ticket: Primitive Types - u64 with wrap Modifier

## Description
Write test for u64 with wrap (wrapping arithmetic) modifier in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using wrap modifier on u64 to enable explicit wrapping arithmetic behavior.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-wrap.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 With wrap modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a u64 variable with wrap modifier
- Example syntax: `wrap u64 value <- 0;`
- Test that overflow wraps around to 0
- Test that underflow wraps around to max value
- Verify transpiled C code allows natural C wrapping behavior

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
