# Ticket: Generic Types - Type<Arg> Declaration

## Description
Write test for basic generic type declaration with a single type argument in C-Next.

## Test Category
Generic Types

## Context Being Tested
Type<Arg> declaration - using a generic type with a single type parameter.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/generic-types/type-arg.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Type<Arg> declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Test declaring and using a generic type with a single type argument
- Verify the transpiler correctly handles the `Type<Arg>` syntax
- Example syntax:
  ```
  Container<u32> myContainer;
  ```
- Note: Generic types are defined in grammar but implementation status is unclear
- This test may reveal that generic types need to be fully implemented

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
