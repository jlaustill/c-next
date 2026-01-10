# Ticket: Primitive Types - i64 with wrap Modifier

## Description
Write test for i64 with wrap (wrapping) overflow modifier in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Declaring i64 variables with wrap modifier that wraps around on overflow/underflow.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i64-wrap.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 With wrap modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap i64 variable
- Example syntax: `wrap i64 wrappingVal <- 9223372036854775807;`
- Test overflow scenario: adding 1 to max value should wrap to -9223372036854775808
- Test underflow scenario: subtracting 1 from min value should wrap to 9223372036854775807
- Verify transpiled C code handles wrapping arithmetic correctly for int64_t

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
