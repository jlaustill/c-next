# Ticket: Bit Indexing - Variable Index

## Description
Write test for bit indexing using a variable as the index in C-Next.

## Test Category
Bit Indexing

## Context Being Tested
Using a variable (not a literal) as the bit index in bit access operations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bit-indexing/bit-index-variable.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Variable index
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare an integer variable to use as the index
- Use that variable in bit access: `u32 idx <- 5; bool bit <- value[idx];`
- Test writing with variable index: `value[idx] <- true;`
- Consider loop scenarios where index varies
- Verify transpiled C code correctly computes the bit mask at runtime

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
