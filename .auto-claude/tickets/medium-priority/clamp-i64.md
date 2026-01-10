# Ticket: Overflow Modifiers - clamp i64

## Description
Write test for clamp (saturating) overflow behavior with i64 type in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing clamp modifier behavior specifically for i64 type, verifying saturating arithmetic at type bounds (INT64_MIN to INT64_MAX).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-i64.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i64 clamp in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a clamp i64 variable
- Test positive overflow: near INT64_MAX + amount should saturate to INT64_MAX
- Test negative overflow: near INT64_MIN - amount should saturate to INT64_MIN
- Example syntax: `clamp i64 value <- 9223372036854775800;`
- Verify both positive and negative saturation works correctly
- Compare with expected C output using saturation macros/inline functions

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
