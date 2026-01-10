# Ticket: Scope Declaration - Private Visibility

## Description
Write test for private visibility modifier on scope members in C-Next.

## Test Category
Scope Declaration

## Context Being Tested
Using the `private` visibility modifier on scope members to restrict access from outside the scope.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/scope-private.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for private visibility
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare private members within a scope
- Verify private members are accessible within scope functions
- Example syntax:
  ```
  scope Counter {
      private u32 value;

      void increment() {
          this.value +<- 1;
      }

      u32 getValue() -> u32 {
          return this.value;
      }
  }
  ```
- Verify transpiled C code correctly encapsulates private members
- Consider adding an error test for accessing private members from outside

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
