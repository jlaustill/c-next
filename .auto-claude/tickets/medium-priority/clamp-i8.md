# Ticket: Overflow Modifiers - clamp i8

## Description
Write test for clamp (saturating) overflow behavior with i8 type in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing clamp modifier behavior specifically for i8 type, verifying saturating arithmetic at type bounds (-128 to 127).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-i8.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 clamp in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp i8 variable
- Test positive overflow: 120 + 20 should saturate to 127
- Test negative overflow: -120 - 20 should saturate to -128
- Example syntax: `clamp i8 value <- 120;`
- Verify both positive and negative saturation works correctly
- Compare with expected C output using saturation macros/inline functions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
