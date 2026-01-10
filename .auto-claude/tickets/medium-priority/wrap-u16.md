# Ticket: Overflow Modifiers - wrap u16

## Description
Write test for wrap (wrapping) overflow behavior with u16 type in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing wrap modifier behavior specifically for u16 type, verifying wrapping arithmetic at type bounds (0-65535).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-u16.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 wrap in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap u16 variable
- Test overflow: 65535 + 1 should wrap to 0
- Test underflow: 0 - 1 should wrap to 65535
- Example syntax: `wrap u16 value <- 65535;`
- Verify wrapping behavior matches expected modular arithmetic
- Compare with expected C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
