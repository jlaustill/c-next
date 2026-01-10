# Ticket: Primitive Types - i16 Wrap Modifier

## Description
Write test for i16 with wrap (wrapping) overflow modifier in C-Next.

## Test Category
Primitive Types - Signed Integers / Overflow Modifiers

## Context Being Tested
Using wrap modifier with i16 type to enable wrapping arithmetic that wraps around on overflow.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i16-wrap.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 With wrap modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare wrap i16 variable
- Example syntax: `wrap i16 value <- 32000;`
- Test overflow scenario: adding past 32767 should wrap to negative values
- Test underflow scenario: subtracting past -32768 should wrap to positive values
- Verify transpiled C code includes wrapping logic
- Reference existing patterns in `primitives/signed-overflow.cnx` and `primitives/wrap-declaration.cnx`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
