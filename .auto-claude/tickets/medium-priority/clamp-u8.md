# Ticket: Overflow Modifiers - clamp u8

## Description
Write test for clamp (saturating) overflow behavior with u8 type in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing clamp modifier behavior specifically for u8 type, verifying saturating arithmetic at type bounds (0-255).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-u8.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 clamp in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp u8 variable
- Test overflow: 250 + 10 should saturate to 255
- Test underflow: 5 - 10 should saturate to 0
- Example syntax: `clamp u8 value <- 250;`
- Verify both addition and subtraction saturate correctly
- Compare with expected C output using saturation macros/inline functions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
