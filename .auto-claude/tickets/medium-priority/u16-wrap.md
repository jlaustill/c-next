# Ticket: Primitive Types - u16 with wrap Modifier

## Description
Write test for u16 with wrap (wrapping) overflow modifier in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using the wrap modifier with u16 to enable wrapping arithmetic that wraps around at min/max bounds.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u16-wrap.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 With wrap modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a u16 variable with wrap modifier
- Perform operations that would overflow (e.g., 65535 + 1 should wrap to 0)
- Perform operations that would underflow (e.g., 0 - 1 should wrap to 65535)
- Example syntax: `wrap u16 wrapped <- 65535;`
- Verify transpiled C code implements wrapping arithmetic correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
