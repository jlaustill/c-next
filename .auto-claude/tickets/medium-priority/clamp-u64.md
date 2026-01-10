# Ticket: Overflow Modifiers - clamp u64

## Description
Write test for clamp (saturating) overflow behavior with u64 type in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing clamp modifier behavior specifically for u64 type, verifying saturating arithmetic at type bounds (0 to 2^64-1).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-u64.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 clamp in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp u64 variable
- Test overflow: near-max value + amount should saturate to UINT64_MAX
- Test underflow: small value - larger value should saturate to 0
- Example syntax: `clamp u64 value <- 18446744073709551610;`
- Verify both addition and subtraction saturate correctly
- Compare with expected C output using saturation macros/inline functions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
