# Ticket: sizeof Operator - Struct Member

## Description
Write test for sizeof operator applied to a struct member in C-Next.

## Test Category
sizeof Operator

## Context Being Tested
Using sizeof on a member of a struct to get the size of that specific field.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/sizeof/struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for sizeof Struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct with members of different sizes
- Access sizeof on a struct member via instance
- Example syntax: `MyStruct instance; u32 size <- sizeof(instance.member);`
- Verify transpiled C code correctly uses sizeof on the member

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
