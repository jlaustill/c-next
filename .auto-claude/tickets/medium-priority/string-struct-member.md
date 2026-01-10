# Ticket: Strings - Struct Member

## Description
Write test for string type as a struct member in C-Next.

## Test Category
Strings

## Context Being Tested
Using string type as a member within struct declarations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/string/string-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Strings - As struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a struct with a string member
- Initialize the struct with string values
- Access and modify the string member
- Example syntax: `struct Person { string[32] name; u32 age; }`
- Verify transpiled C code correctly handles string member initialization
- Test string member access via struct.member syntax
- Consider testing nested struct with string members

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
