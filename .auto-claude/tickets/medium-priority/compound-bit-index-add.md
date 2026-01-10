# Ticket: Assignment Operators - Compound Add on Bit Index

## Description
Write test for compound add (+<-) operator on bit index in C-Next.

## Test Category
Assignment Operators - Compound Assignment

## Context Being Tested
Using the compound add assignment operator (+<-) on a bit index target.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/assignment/compound-bit-index-add.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Bit index +<-
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a variable and use bit indexing with compound add
- Example syntax: `value[3] +<- 1;`
- Verify transpiled C code correctly handles the compound operation on a bit
- Consider edge cases like bit overflow behavior

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
