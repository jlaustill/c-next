# Ticket: ISR Type - ISR as Parameter

## Description
Write test for passing ISR (Interrupt Service Routine) type as a function parameter in C-Next.

## Test Category
ISR Type

## Context Being Tested
Using ISR type as a function parameter, allowing functions to accept interrupt handlers as arguments.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/isr/isr-as-parameter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ISR as parameter
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a function that takes an ISR as a parameter
- Pass an ISR function to that function
- Verify the ISR can be stored/used within the receiving function
- Reference existing ISR tests: `isr/isr-basic.cnx`, `isr/isr-assignment.cnx`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
