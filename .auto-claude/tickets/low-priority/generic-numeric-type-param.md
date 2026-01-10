# Ticket: Generic Types - Numeric Type Parameter

## Description
Write test for numeric type parameters (const generics) in C-Next.

## Test Category
Generic Types

## Context Being Tested
Numeric type parameter - a type parameter that takes a compile-time numeric value rather than a type.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/generic-types/numeric-type-param.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Numeric type parameter
- [ ] Jest test runner passes

## Test Implementation Notes
- Test declaring and using a type with a numeric type parameter (const generic)
- Verify the transpiler correctly handles numeric/const generic syntax
- Example syntax:
  ```
  struct FixedArray<N: u32> {
      data: u32[N]
  }

  buffer: FixedArray<10>;
  ```
- This is similar to Rust's const generics or C++ template non-type parameters
- Note: Generic types are defined in grammar but implementation status is unclear
- This test may reveal that numeric type parameters need to be fully implemented

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
