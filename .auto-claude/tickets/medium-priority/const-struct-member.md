# Ticket: Const Modifier - Struct Member

## Description
Write test for const modifier on struct members in C-Next.

## Test Category
Const Modifier

## Context Being Tested
Using const modifier on individual struct member declarations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/const/const-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Const Modifier - Struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a struct with const member(s)
- Example syntax: `struct Config { const u32 version; u32 count; }`
- Verify const member can be initialized during struct creation
- Verify assignment to const member produces compile error
- Test mixing const and non-const members in same struct
- Verify transpiled C code uses `const` qualifier on the member

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
