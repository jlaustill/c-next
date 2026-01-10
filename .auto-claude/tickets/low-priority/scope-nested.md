# Ticket: Scope Declaration - Nested Scopes

## Description
Write test for nested scope declarations in C-Next.

## Test Category
Scope Declaration

## Context Being Tested
Nested scopes - declaring a scope inside another scope and accessing members correctly.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/scope/nested-scopes.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Nested scopes"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test declaring a scope inside another scope
- Verify `this.` access works correctly at each nesting level
- Test accessing outer scope members from inner scope
- Test qualified access from outside (e.g., `OuterScope.InnerScope.member`)
- Example syntax:
  ```
  scope OuterScope {
      u32 outerValue <- 100;

      scope InnerScope {
          u32 innerValue <- 200;

          fn innerFunc() -> u32 {
              return this.innerValue;
          }
      }
  }
  ```
- Verify proper C code generation for nested namespace-like structures
- Test function calls and variable access across scope boundaries

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
