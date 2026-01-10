# Ticket: Bit Indexing - On u64

## Description
Write test for bit indexing operations on u64 variables in C-Next.

## Test Category
Bit Indexing

## Context Being Tested
Using bit indexing syntax ([n] for single bit, [start..end] for range) on u64 type variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bit-indexing/bit-index-u64.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for On u64
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare u64 variable and access individual bits using [n] syntax
- Test reading bits: `bool bit <- value[32];`
- Test writing bits: `value[63] <- true;`
- Test bit range access if applicable
- Verify transpiled C code correctly handles 64-bit values

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
