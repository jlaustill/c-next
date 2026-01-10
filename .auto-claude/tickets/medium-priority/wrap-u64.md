# Ticket: Overflow Modifiers - wrap u64

## Description
Write test for wrap (wrapping) overflow behavior with u64 type in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing wrap modifier behavior specifically for u64 type, verifying wrapping arithmetic at type bounds (0 to 2^64-1).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-u64.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 wrap in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap u64 variable
- Test overflow: UINT64_MAX + 1 should wrap to 0
- Test underflow: 0 - 1 should wrap to UINT64_MAX
- Example syntax: `wrap u64 value <- 18446744073709551615;`
- Verify wrapping behavior matches expected modular arithmetic
- Compare with expected C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
