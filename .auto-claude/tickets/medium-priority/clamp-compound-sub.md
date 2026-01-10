# Ticket: Overflow Modifiers - clamp Compound Subtraction

## Description
Write test for clamp (saturating) behavior with compound subtraction operator (-<-) in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing that compound subtraction assignment (-<-) correctly saturates when used with clamp modifier variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-compound-sub.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Compound sub in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare clamp variables of various integer types
- Use compound subtraction: `value -<- 100;`
- Test underflow scenarios that should saturate to minimum
- Test with u32: `clamp u32 val <- 50; val -<- 100;` should give 0
- Test with i32: `clamp i32 val <- -2147483640; val -<- 100;` should give INT32_MIN
- Verify transpiled C code implements saturating compound subtraction

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
