# Ticket: C Interoperability - Volatile Qualifier

## Description
Write test for using the volatile qualifier in C-Next code.

## Test Category
C Interoperability

## Context Being Tested
Using the `volatile` keyword to mark variables that may be modified by external factors (hardware, interrupts, etc.).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/c-interop/volatile-qualifier.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Volatile qualifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a volatile variable (e.g., `volatile u32 hwRegister;`)
- Read and write to the volatile variable
- Verify transpiled C code includes `volatile` keyword
- This is essential for embedded systems where memory-mapped registers must not be optimized away
- Example use case: hardware status register polling

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
