# Ticket: Atomic Modifier - Atomic with clamp

## Description
Write test for combining the atomic modifier with the clamp (saturating) overflow modifier in C-Next.

## Test Category
Atomic Modifier

## Context Being Tested
Using both atomic and clamp modifiers together on a variable to get thread-safe saturating arithmetic operations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/atomic/atomic-with-clamp.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for atomic With clamp
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a variable with both atomic and clamp modifiers
- Example syntax: `atomic clamp u32 counter <- 0;` or `clamp atomic u32 counter <- 0;`
- Test compound operations that would overflow/underflow
- Verify the transpiled C code generates both atomic intrinsics and saturating logic
- Test on types where atomic is supported (u8, u16, u32, u64, i8, i16, i32, i64)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
