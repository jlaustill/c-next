# Ticket: Assignment Operators - Compound Bitwise XOR on global.member

## Description
Write test for compound bitwise XOR (^<-) operator on global.member in C-Next.

## Test Category
Assignment Operators - Compound Assignment

## Context Being Tested
Using the compound bitwise XOR assignment operator (^<-) on a scope member accessed via `global.member` syntax from a non-scope context.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/compound-global-xor.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for global.member ^<-
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a scope with a member variable
- Use compound bitwise XOR on `global.ScopeName.member` from outside the scope
- Example syntax: `global.MyScope.flags ^<- 0xFF;`
- Verify transpiled C code correctly generates the compound operation

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
