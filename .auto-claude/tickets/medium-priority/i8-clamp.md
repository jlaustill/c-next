# Ticket: Primitive Types - i8 with clamp Modifier

## Description
Write test for i8 with clamp (saturating) overflow modifier in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Declaring i8 variables with clamp modifier that saturates on overflow/underflow.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i8-clamp.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 With clamp modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp i8 variable
- Example syntax: `clamp i8 saturatingVal <- 100;`
- Test overflow scenario: adding to near-max value should clamp to 127
- Test underflow scenario: subtracting from near-min value should clamp to -128
- Verify transpiled C code handles saturating arithmetic correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
