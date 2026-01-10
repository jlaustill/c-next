# Ticket: Overflow Modifiers - clamp Underflow to Min

## Description
Write test for clamp (saturating) behavior specifically verifying underflow clamps to minimum value in C-Next.

## Test Category
Overflow Modifiers - clamp (Saturating)

## Context Being Tested
Testing that clamp modifier correctly saturates to minimum value (0 for unsigned, MIN for signed) on underflow operations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/overflow/clamp-underflow.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Underflow to min in Section 21.1
- [ ] Jest test runner passes

## Test Implementation Notes
- Test unsigned underflow: `clamp u32 val <- 10; val -<- 100;` should give 0
- Test signed underflow: `clamp i32 val <- -2147483640; val -<- 20;` should give -2147483648
- Test multiple underflow operations in sequence
- Test underflow with different unsigned types (u8, u16, u32, u64)
- Test underflow with different signed types (i8, i16, i32, i64)
- Verify minimum bounds are correct for each type

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
