# Ticket: Overflow Modifiers - clamp i16

## Description
Write test for clamp (saturating) overflow behavior with i16 type in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing clamp modifier behavior specifically for i16 type, verifying saturating arithmetic at type bounds (-32768 to 32767).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-i16.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 clamp in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp i16 variable
- Test positive overflow: 32760 + 20 should saturate to 32767
- Test negative overflow: -32760 - 20 should saturate to -32768
- Example syntax: `clamp i16 value <- 32760;`
- Verify both positive and negative saturation works correctly
- Compare with expected C output using saturation macros/inline functions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
