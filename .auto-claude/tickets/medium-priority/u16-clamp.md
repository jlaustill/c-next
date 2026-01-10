# Ticket: Primitive Types - u16 with clamp Modifier

## Description
Write test for u16 with clamp (saturating) overflow modifier in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using the clamp modifier with u16 to enable saturating arithmetic that clamps at min/max bounds instead of overflowing.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u16-clamp.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 With clamp modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a u16 variable with clamp modifier
- Perform operations that would overflow (e.g., 65530 + 20 should clamp to 65535)
- Perform operations that would underflow (e.g., 5 - 10 should clamp to 0)
- Example syntax: `clamp u16 clamped <- 65530;`
- Verify transpiled C code implements saturating arithmetic correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
