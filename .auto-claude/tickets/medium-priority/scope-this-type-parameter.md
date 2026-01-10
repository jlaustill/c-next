# Ticket: Scope Declaration - this.Type as Parameter

## Description
Write test for using this.Type as a function parameter type within a scope in C-Next.

## Test Category
Scope Declaration - Scoped Types

## Context Being Tested
Using `this.Type` syntax to specify the type of a function parameter within the same scope.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/this-type-parameter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for this.Type as parameter
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct or enum type inside a scope
- Use `this.TypeName` as a function parameter type
- Example syntax:
  ```
  scope Protocol {
      struct Message {
          u8 id;
          u32 payload;
      }

      void sendMessage(this.Message msg) {
          // Process the message
      }

      void process() {
          this.Message m;
          m.id <- 1;
          m.payload <- 0xDEADBEEF;
          this.sendMessage(m);
      }
  }
  ```
- Verify transpiled C code correctly resolves the parameter type

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
