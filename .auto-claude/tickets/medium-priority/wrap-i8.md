# Ticket: Overflow Modifiers - wrap i8

## Description
Write test for wrap (wrapping) overflow behavior with i8 type in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing wrap modifier behavior specifically for i8 type, verifying wrapping arithmetic at type bounds (-128 to 127).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-i8.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i8 wrap in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap i8 variable
- Test positive overflow: 127 + 1 should wrap to -128
- Test negative overflow: -128 - 1 should wrap to 127
- Example syntax: `wrap i8 value <- 127;`
- Verify wrapping behavior matches expected two's complement arithmetic
- Compare with expected C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
