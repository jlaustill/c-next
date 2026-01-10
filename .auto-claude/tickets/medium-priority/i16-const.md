# Ticket: Primitive Types - i16 Const Modifier

## Description
Write test for i16 with const modifier in C-Next.

## Test Category
Primitive Types - Signed Integers

## Context Being Tested
Using const modifier with i16 type to create immutable signed 16-bit integer values.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i16-const.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 With const modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare const i16 variable with initialization
- Example syntax: `const i16 MIN_VALUE <- -32768;`
- Example syntax: `const i16 MAX_VALUE <- 32767;`
- Verify the value can be read/used in expressions
- Verify transpiled C code uses `const int16_t`
- Consider testing const i16 used in function parameters

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
