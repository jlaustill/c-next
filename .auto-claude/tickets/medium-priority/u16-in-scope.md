# Ticket: Primitive Types - u16 in Scope Declaration

## Description
Write test for u16 variable within a scope declaration in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Declaring and using u16 variables inside a scope block, accessed via this.member syntax.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u16-in-scope.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 In scope declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a scope with a u16 member variable
- Access the variable using this.member syntax within scope functions
- Example syntax:
  ```
  scope MyScope {
      u16 counter;

      void increment() {
          this.counter +<- 1;
      }
  }
  ```
- Verify transpiled C code correctly handles scoped u16 variables

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
