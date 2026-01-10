# Ticket: Primitive Types - i8 with const Modifier

## Description
Write test for i8 with const modifier in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Declaring const i8 variables that cannot be modified after initialization.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i8-const.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 With const modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a const i8 variable with initialization
- Example syntax: `const i8 MIN_VALUE <- -128;`
- Test with both positive and negative values
- Verify the value can be read but not modified
- Verify transpiled C code uses `const int8_t`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
