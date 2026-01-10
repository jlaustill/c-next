# Ticket: Logical Operators - Double Negation (!!)

## Description
Write test for double negation (!!) in C-Next.

## Test Category
Logical Operators - NOT (!)

## Context Being Tested
Using double negation (!!) to convert a value to a normalized boolean (true/false).

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/logical/logical-double-negation.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Double negation (!!)" under 6.3 NOT (!)
- [ ] Jest test runner passes

## Test Implementation Notes
- Apply !! to boolean variables and expressions
- Example syntax: `bool normalized <- !!someValue;`
- Test that !!true = true and !!false = false
- Verify transpiled C code correctly handles double negation

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
