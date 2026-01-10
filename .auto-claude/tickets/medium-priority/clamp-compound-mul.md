# Ticket: Overflow Modifiers - clamp Compound Multiplication

## Description
Write test for clamp (saturating) behavior with compound multiplication operator (*<-) in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing that compound multiplication assignment (*<-) correctly saturates when used with clamp modifier variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-compound-mul.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Compound mul in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare clamp variables of various integer types
- Use compound multiplication: `value *<- 100;`
- Test overflow scenarios that should saturate to maximum
- Test with u32: `clamp u32 val <- 100000000; val *<- 100;` should give UINT32_MAX
- Test with i32: `clamp i32 val <- 100000000; val *<- 100;` should give INT32_MAX
- Test negative multiplication overflow for signed types
- Verify transpiled C code implements saturating compound multiplication

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
