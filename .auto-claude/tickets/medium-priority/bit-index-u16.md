# Ticket: Bit Indexing - On u16

## Description
Write test for bit indexing operations on u16 variables in C-Next.

## Test Category
Bit Indexing

## Context Being Tested
Using bit indexing syntax ([n] for single bit, [start..end] for range) on u16 type variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bit-indexing/bit-index-u16.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for On u16
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare u16 variable and access individual bits using [n] syntax
- Test reading bits: `bool bit <- value[10];`
- Test writing bits: `value[15] <- true;`
- Test bit range access if applicable
- Verify transpiled C code correctly handles 16-bit values

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
