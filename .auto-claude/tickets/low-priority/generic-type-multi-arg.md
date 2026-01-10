# Ticket: Generic Types - Type<Arg1, Arg2>

## Description
Write test for generic type declaration with multiple type arguments in C-Next.

## Test Category
Generic Types

## Context Being Tested
Type<Arg1, Arg2> declaration - using a generic type with multiple type parameters.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/generic-types/type-multi-arg.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Type<Arg1, Arg2>
- [ ] Jest test runner passes

## Test Implementation Notes
- Test declaring and using a generic type with multiple type arguments
- Verify the transpiler correctly handles the `Type<Arg1, Arg2>` syntax
- Example syntax:
  ```
  Pair<u32, bool> myPair;
  Map<string, u32> myMap;
  ```
- Note: Generic types are defined in grammar but implementation status is unclear
- This test may reveal that generic types need to be fully implemented

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
