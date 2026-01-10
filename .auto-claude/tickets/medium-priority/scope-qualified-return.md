# Ticket: Scope Declaration - Scope.Type as Return

## Description
Write test for using Scope.Type as a function return type from outside the scope in C-Next.

## Test Category
Scope Declaration - Qualified Types

## Context Being Tested
Using `ScopeName.TypeName` syntax to specify a function return type when returning a type from another scope.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/qualified-type-return.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Scope.Type as return
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct or enum type inside a scope
- Use `ScopeName.TypeName` as a return type from outside the scope
- Example syntax:
  ```
  scope Math {
      struct Vector2 {
          i32 x;
          i32 y;
      }
  }

  Math.Vector2 createVector(i32 x, i32 y) -> Math.Vector2 {
      Math.Vector2 v;
      v.x <- x;
      v.y <- y;
      return v;
  }

  Math.Vector2 addVectors(Math.Vector2 a, Math.Vector2 b) -> Math.Vector2 {
      Math.Vector2 result;
      result.x <- a.x + b.x;
      result.y <- a.y + b.y;
      return result;
  }

  void main() {
      Math.Vector2 v1 <- createVector(1, 2);
      Math.Vector2 v2 <- createVector(3, 4);
      Math.Vector2 sum <- addVectors(v1, v2);
  }
  ```
- Verify transpiled C code correctly resolves the qualified return type

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
