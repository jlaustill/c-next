# Ticket: Overflow Modifiers - wrap Compound Multiplication

## Description
Write test for wrap (wrapping) behavior with compound multiplication operator (*<-) in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing that compound multiplication assignment (*<-) correctly wraps when used with wrap modifier variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-compound-mul.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Compound mul in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare wrap variables of various integer types
- Use compound multiplication: `value *<- 100;`
- Test overflow scenarios that should wrap
- Test with u32: large value * large multiplier should wrap modulo 2^32
- Test with i32: multiplication overflow wrapping behavior
- Verify transpiled C code implements wrapping compound multiplication

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
