# Ticket: Overflow Modifiers - clamp u16

## Description
Write test for clamp (saturating) overflow behavior with u16 type in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing clamp modifier behavior specifically for u16 type, verifying saturating arithmetic at type bounds (0-65535).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-u16.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 clamp in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp u16 variable
- Test overflow: 65530 + 10 should saturate to 65535
- Test underflow: 5 - 10 should saturate to 0
- Example syntax: `clamp u16 value <- 65530;`
- Verify both addition and subtraction saturate correctly
- Compare with expected C output using saturation macros/inline functions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
