# Ticket: Generic Types - Generic Struct

## Description
Write test for generic struct declarations in C-Next.

## Test Category
Generic Types

## Context Being Tested
Generic struct - a struct definition that uses type parameters for member types.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/generic-types/generic-struct.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Generic struct
- [ ] Jest test runner passes

## Test Implementation Notes
- Test declaring and using a generic struct
- Verify the transpiler correctly handles generic struct syntax
- Example syntax:
  ```
  struct Container<T> {
      value: T,
      count: u32
  }

  container: Container<u32>;
  container.value <- 42;
  ```
- Note: Generic types are defined in grammar but implementation status is unclear
- This test may reveal that generic structs need to be fully implemented

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
