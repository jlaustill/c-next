# Ticket: ISR Type - ISR Invocation

## Description
Write test for invoking (calling) an ISR (Interrupt Service Routine) in C-Next.

## Test Category
ISR Type

## Context Being Tested
Directly calling/invoking an ISR function, verifying that ISR functions can be invoked like regular void functions.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/isr/isr-invocation.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ISR invocation
- [ ] Jest test runner passes

## Test Implementation Notes
- Define an ISR function
- Invoke the ISR directly (not through hardware interrupt)
- Verify the invocation syntax and transpiled C code
- Note: ISRs typically have no parameters and return void
- Reference existing ISR tests: `isr/isr-basic.cnx`, `isr/isr-assignment.cnx`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
