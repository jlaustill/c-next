# Ticket: Overflow Modifiers - clamp with atomic

## Description
Write test for clamp (saturating) modifier combined with atomic modifier in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing that clamp and atomic modifiers can be combined, providing both atomic operations and saturating arithmetic.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-with-atomic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for With atomic in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare variable with both modifiers: `atomic clamp u32 counter <- 0;`
- Test that atomic compound operations also saturate
- Verify modifier order is handled correctly (atomic clamp vs clamp atomic)
- Test overflow: atomic increment near max should saturate
- Test underflow: atomic decrement near min should saturate
- Verify transpiled C code uses both atomic intrinsics and saturation logic

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
