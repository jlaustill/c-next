# Ticket: Scope Declaration - Scope.Type as Parameter

## Description
Write test for using Scope.Type as a function parameter type from outside the scope in C-Next.

## Test Category
Scope Declaration - Qualified Types

## Context Being Tested
Using `ScopeName.TypeName` syntax to specify a function parameter type when accessing a type from another scope.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/qualified-type-parameter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Scope.Type as parameter
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct or enum type inside a scope
- Use `ScopeName.TypeName` as a parameter type from outside the scope
- Example syntax:
  ```
  scope Geometry {
      struct Point {
          i32 x;
          i32 y;
      }
  }

  void printPoint(Geometry.Point p) {
      // Use the point from Geometry scope
  }

  i32 calculateDistance(Geometry.Point a, Geometry.Point b) -> i32 {
      i32 dx <- a.x - b.x;
      i32 dy <- a.y - b.y;
      return dx * dx + dy * dy;
  }

  void main() {
      Geometry.Point origin;
      origin.x <- 0;
      origin.y <- 0;
      this.printPoint(origin);
  }
  ```
- Verify transpiled C code correctly resolves the qualified type reference

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
