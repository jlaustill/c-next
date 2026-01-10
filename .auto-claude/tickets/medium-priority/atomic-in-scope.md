# Ticket: Atomic Modifier - Atomic in scope

## Description
Write test for using the atomic modifier on variables declared inside a scope declaration in C-Next.

## Test Category
Atomic Modifier

## Context Being Tested
Declaring atomic variables as members of a scope (namespace), accessible via this.member or ScopeName.member syntax.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/atomic/atomic-in-scope.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for atomic In scope
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a scope with atomic member variables
- Access the atomic variable via `this.member` from within scope functions
- Test compound assignment on scoped atomic variables
- Verify the transpiled C code properly handles atomic operations through scope indirection
- Example:
  ```
  scope MyModule {
      atomic u32 counter <- 0;

      fn increment() -> void {
          this.counter +<- 1;
      }
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
