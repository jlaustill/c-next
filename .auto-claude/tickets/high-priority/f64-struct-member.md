# Ticket: Primitive Types - f64 Struct Member

## Description
Write test for f64 as a struct member type in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Struct containing an f64 member field.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct with an f64 member
- Test accessing and assigning to the f64 member
- Verify the transpiled C code correctly declares the double struct member
- Example syntax:
  ```
  struct PreciseMeasurement {
      f64 value;
      u32 timestamp;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
