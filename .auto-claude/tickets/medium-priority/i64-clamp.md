# Ticket: Primitive Types - i64 with clamp Modifier

## Description
Write test for i64 with clamp (saturating) overflow modifier in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Declaring i64 variables with clamp modifier that saturates on overflow/underflow.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i64-clamp.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 With clamp modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp i64 variable
- Example syntax: `clamp i64 saturatingVal <- 9223372036854775800;`
- Test overflow scenario: adding to near-max value should clamp to 9223372036854775807
- Test underflow scenario: subtracting from near-min value should clamp to -9223372036854775808
- Verify transpiled C code handles saturating arithmetic correctly for int64_t

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
