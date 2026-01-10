# Ticket: Primitive Types - i64 with const Modifier

## Description
Write test for i64 with const modifier in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Declaring const i64 variables that cannot be modified after initialization.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i64-const.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 With const modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a const i64 variable with initialization
- Example syntax: `const i64 maxValue <- 9223372036854775807;`
- Verify the value can be read and used in expressions
- Verify transpiled C code uses `const int64_t`
- Consider adding an error test for attempting to modify const i64

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
