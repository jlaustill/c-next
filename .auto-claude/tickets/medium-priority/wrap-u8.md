# Ticket: Overflow Modifiers - wrap u8

## Description
Write test for wrap (wrapping) overflow behavior with u8 type in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing wrap modifier behavior specifically for u8 type, verifying wrapping arithmetic at type bounds (0-255).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-u8.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 wrap in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap u8 variable
- Test overflow: 255 + 1 should wrap to 0
- Test underflow: 0 - 1 should wrap to 255
- Example syntax: `wrap u8 value <- 255;`
- Verify wrapping behavior matches expected modular arithmetic
- Compare with expected C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
