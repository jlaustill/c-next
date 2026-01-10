# Ticket: Primitive Types - i8 with wrap Modifier

## Description
Write test for i8 with wrap (wrapping) overflow modifier in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Declaring i8 variables with wrap modifier that wraps on overflow/underflow.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i8-wrap.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 With wrap modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap i8 variable
- Example syntax: `wrap i8 wrappingVal <- 100;`
- Test overflow scenario: 127 + 1 should wrap to -128
- Test underflow scenario: -128 - 1 should wrap to 127
- Verify transpiled C code handles wrapping arithmetic correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
