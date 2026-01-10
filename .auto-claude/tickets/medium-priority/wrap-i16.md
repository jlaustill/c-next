# Ticket: Overflow Modifiers - wrap i16

## Description
Write test for wrap (wrapping) overflow behavior with i16 type in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing wrap modifier behavior specifically for i16 type, verifying wrapping arithmetic at type bounds (-32768 to 32767).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-i16.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 wrap in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap i16 variable
- Test positive overflow: 32767 + 1 should wrap to -32768
- Test negative overflow: -32768 - 1 should wrap to 32767
- Example syntax: `wrap i16 value <- 32767;`
- Verify wrapping behavior matches expected two's complement arithmetic
- Compare with expected C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
