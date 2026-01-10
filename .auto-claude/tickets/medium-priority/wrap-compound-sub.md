# Ticket: Overflow Modifiers - wrap Compound Subtraction

## Description
Write test for wrap (wrapping) behavior with compound subtraction operator (-<-) in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing that compound subtraction assignment (-<-) correctly wraps when used with wrap modifier variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-compound-sub.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Compound sub in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare wrap variables of various integer types
- Use compound subtraction: `value -<- 100;`
- Test underflow scenarios that should wrap
- Test with u32: `wrap u32 val <- 50; val -<- 100;` should wrap to UINT32_MAX - 49
- Test with i32: wrapping from negative to positive boundary
- Verify transpiled C code implements wrapping compound subtraction

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
