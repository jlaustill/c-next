# Ticket: Overflow Modifiers - wrap with atomic

## Description
Write test for wrap (wrapping) modifier combined with atomic modifier in C-Next.

## Test Category
Overflow Modifiers - wrap (Wrapping)

## Context Being Tested
Testing that wrap and atomic modifiers can be combined, providing both atomic operations and wrapping arithmetic.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/wrap-with-atomic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for With atomic in Section 21.2
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare variable with both modifiers: `atomic wrap u32 counter <- 0;`
- Test that atomic compound operations also wrap
- Verify modifier order is handled correctly (atomic wrap vs wrap atomic)
- Test overflow: atomic increment at max should wrap to 0
- Test underflow: atomic decrement at 0 should wrap to max
- Verify transpiled C code uses both atomic intrinsics and wrapping behavior

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
