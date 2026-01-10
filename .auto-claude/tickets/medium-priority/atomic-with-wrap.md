# Ticket: Atomic Modifier - Atomic with wrap

## Description
Write test for combining the atomic modifier with the wrap (wrapping) overflow modifier in C-Next.

## Test Category
Atomic Modifier

## Context Being Tested
Using both atomic and wrap modifiers together on a variable to get thread-safe wrapping arithmetic operations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/atomic/atomic-with-wrap.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for atomic With wrap
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a variable with both atomic and wrap modifiers
- Example syntax: `atomic wrap u32 counter <- 0;` or `wrap atomic u32 counter <- 0;`
- Test compound operations that would overflow/underflow and verify they wrap correctly
- Verify the transpiled C code generates both atomic intrinsics and wrapping logic
- Test on types where atomic is supported (u8, u16, u32, u64, i8, i16, i32, i64)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
