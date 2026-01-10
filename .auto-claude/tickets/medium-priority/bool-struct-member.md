# Ticket: Primitive Types - Boolean Struct Member

## Description
Write test for bool as a struct member type in C-Next.

## Test Category
Primitive Types - Boolean

## Context Being Tested
Using bool as a member type within struct declarations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/bool-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Boolean Struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a struct with a bool member
- Initialize the struct with true/false values
- Access and modify the bool member
- Example syntax: `struct Flags { bool enabled; bool active; }`
- Verify transpiled C code uses `bool` or `_Bool` for the member

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
