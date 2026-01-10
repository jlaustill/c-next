# Ticket: Scope Declaration - this.Type as Return

## Description
Write test for using this.Type as a function return type within a scope in C-Next.

## Test Category
Scope Declaration - Scoped Types

## Context Being Tested
Using `this.Type` syntax to specify the return type of a function within the same scope.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/this-type-return.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for this.Type as return
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct or enum type inside a scope
- Use `this.TypeName` as a function return type
- Example syntax:
  ```
  scope Factory {
      struct Widget {
          u32 id;
          u8 flags;
      }

      this.Widget createWidget(u32 widgetId) -> this.Widget {
          this.Widget w;
          w.id <- widgetId;
          w.flags <- 0;
          return w;
      }

      void test() {
          this.Widget result <- this.createWidget(42);
      }
  }
  ```
- Verify transpiled C code correctly resolves the return type

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
