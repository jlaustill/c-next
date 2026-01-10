# Ticket: Primitive Types - u8 with clamp Modifier

## Description
Write test for u8 with clamp (saturating) overflow modifier in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using the clamp modifier with u8 to enable saturating arithmetic that clamps at min/max bounds instead of overflowing.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u8-clamp.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 With clamp modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a u8 variable with clamp modifier
- Perform operations that would overflow (e.g., 250 + 20 should clamp to 255)
- Perform operations that would underflow (e.g., 5 - 10 should clamp to 0)
- Example syntax: `clamp u8 clamped <- 250;`
- Verify transpiled C code implements saturating arithmetic correctly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
