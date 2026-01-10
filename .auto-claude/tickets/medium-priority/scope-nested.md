# Ticket: Scope Declaration - Nested Scopes

## Description
Write test for nested scope declarations in C-Next.

## Test Category
Scope Declaration

## Context Being Tested
Declaring scopes inside other scopes and accessing members through the scope hierarchy.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/scope/scope-nested.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Nested scopes
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a scope inside another scope
- Access nested scope members using qualified names
- Example syntax:
  ```
  scope Outer {
      u32 outerValue;

      scope Inner {
          u32 innerValue;

          void setInner(u32 val) {
              this.innerValue <- val;
          }
      }

      void setOuter(u32 val) {
          this.outerValue <- val;
      }
  }

  void main() {
      Outer.outerValue <- 10;
      Outer.Inner.innerValue <- 20;
  }
  ```
- Verify transpiled C code correctly handles scope nesting

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
