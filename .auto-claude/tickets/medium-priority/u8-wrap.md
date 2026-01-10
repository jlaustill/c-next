# Ticket: Primitive Types - u8 with wrap Modifier

## Description
Write test for u8 with wrap (wrapping) overflow modifier in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using the wrap modifier with u8 to enable wrapping arithmetic that wraps around at min/max bounds.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u8-wrap.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 With wrap modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a u8 variable with wrap modifier
- Perform operations that would overflow (e.g., 255 + 1 should wrap to 0)
- Perform operations that would underflow (e.g., 0 - 1 should wrap to 255)
- Example syntax: `wrap u8 wrapped <- 255;`
- Verify transpiled C code implements wrapping arithmetic correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
