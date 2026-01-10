# Ticket: Struct Declaration - Struct in Scope

## Description
Write test for struct declaration inside a scope in C-Next.

## Test Category
Struct Declaration

## Context Being Tested
Declaring and using a struct type within a scope declaration.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/structs/struct-in-scope.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Struct in scope"
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a scope with a struct declaration inside
- Use `this.StructName` to reference the scoped struct
- Instantiate and use the struct within scope functions
- Verify transpiled C code properly namespaces the struct
- Example:
  ```
  scope MyModule {
      struct Config {
          u32 value;
          bool enabled;
      }

      this.Config config;

      fn init() -> void {
          this.config <- this.Config{value: 100, enabled: true};
      }
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
