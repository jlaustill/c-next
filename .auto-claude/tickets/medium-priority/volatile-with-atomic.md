# Ticket: Volatile Modifier - With Atomic

## Description
Write test for combining volatile and atomic modifiers in C-Next.

## Test Category
Modifiers - Volatile

## Context Being Tested
Using volatile together with atomic modifier on variable declarations. This combination ensures both atomic access and volatile semantics.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/modifiers/volatile-with-atomic.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for volatile With atomic
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a variable with both volatile and atomic modifiers
- Example syntax: `volatile atomic u32 sharedHwCounter <- 0;`
- Verify transpiled C code includes both volatile semantics and atomic operations
- Test read and write operations to the variable
- Use case: shared hardware counters accessed by multiple threads/ISRs

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
