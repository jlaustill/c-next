# Ticket: Overflow Modifiers - wrap i64

## Description
Write test for wrap (wrapping) overflow behavior with i64 type in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing wrap modifier behavior specifically for i64 type, verifying wrapping arithmetic at type bounds (INT64_MIN to INT64_MAX).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-i64.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 wrap in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a wrap i64 variable
- Test positive overflow: INT64_MAX + 1 should wrap to INT64_MIN
- Test negative overflow: INT64_MIN - 1 should wrap to INT64_MAX
- Example syntax: `wrap i64 value <- 9223372036854775807;`
- Verify wrapping behavior matches expected two's complement arithmetic
- Compare with expected C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
