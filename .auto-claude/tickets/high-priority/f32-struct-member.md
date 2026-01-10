# Ticket: Primitive Types - f32 Struct Member

## Description
Write test for f32 as a struct member type in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Struct containing an f32 member field.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct with an f32 member
- Test accessing and assigning to the f32 member
- Verify the transpiled C code correctly declares the float struct member
- Example syntax:
  ```
  struct Measurement {
      f32 value;
      u32 timestamp;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
