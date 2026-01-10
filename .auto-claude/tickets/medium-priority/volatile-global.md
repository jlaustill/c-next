# Ticket: Volatile Modifier - Global Variable

## Description
Write test for volatile modifier on global variable declarations in C-Next.

## Test Category
Modifiers - Volatile

## Context Being Tested
Using the volatile modifier on global variable declarations to indicate that the variable may be modified by external factors (hardware, ISRs, other threads).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/modifiers/volatile-global.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for volatile Global variable
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a global variable with the volatile modifier
- Test with different types (u32, u8, etc.)
- Example syntax: `volatile u32 hwRegister <- 0;`
- Verify transpiled C code includes the `volatile` keyword in the correct position
- Volatile prevents compiler optimizations that assume the value doesn't change unexpectedly

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
