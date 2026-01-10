# Ticket: ISR Type - ISR in Struct

## Description
Write test for using ISR (Interrupt Service Routine) type as a struct member in C-Next.

## Test Category
ISR Type

## Context Being Tested
Using ISR type as a member of a struct, allowing structs to contain interrupt handler references.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/isr/isr-in-struct.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for ISR in struct
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct with an ISR member
- Initialize the struct with an ISR reference
- Access and potentially invoke the ISR through the struct member
- Reference existing ISR tests: `isr/isr-basic.cnx`, `isr/isr-assignment.cnx`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
