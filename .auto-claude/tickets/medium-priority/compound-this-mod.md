# Ticket: Assignment Operators - Compound Mod on this.member

## Description
Write test for compound modulo (%<-) operator on this.member in C-Next.

## Test Category
Assignment Operators - Compound Assignment

## Context Being Tested
Using the compound modulo assignment operator (%<-) on a scope member accessed via `this.member` syntax.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/compound-this-mod.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for this.member %<-
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a scope with a member variable
- Use compound modulo on `this.member` within a scope function
- Example syntax: `this.value %<- 10;`
- Verify transpiled C code correctly generates the compound operation

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
