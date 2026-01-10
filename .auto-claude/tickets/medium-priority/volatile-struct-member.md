# Ticket: Volatile Modifier - Struct Member

## Description
Write test for volatile modifier on struct member declarations in C-Next.

## Test Category
Modifiers - Volatile

## Context Being Tested
Using the volatile modifier on individual struct member fields.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/modifiers/volatile-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for volatile Struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a struct with a volatile member field
- Test accessing and modifying the volatile member
- Example syntax:
  ```
  struct HardwareStatus {
      volatile u32 statusReg;
      u32 normalField;
  }
  ```
- Verify transpiled C code includes `volatile` on the correct struct member
- Useful for memory-mapped hardware registers represented as struct fields

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
