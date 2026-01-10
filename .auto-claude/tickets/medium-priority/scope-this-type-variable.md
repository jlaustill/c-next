# Ticket: Scope Declaration - this.Type as Variable

## Description
Write test for declaring local variables using this.Type syntax within a scope function in C-Next.

## Test Category
Scope Declaration - Scoped Types

## Context Being Tested
Using `this.Type` syntax to declare a local variable of a scope-defined type within a scope function.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/this-type-variable.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for this.Type as variable
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct or enum type inside a scope
- Declare a local variable using `this.TypeName` syntax in a function
- Example syntax:
  ```
  scope DataProcessor {
      struct Buffer {
          u32[16] data;
          u8 count;
      }

      void processData() {
          this.Buffer localBuffer;
          localBuffer.count <- 0;
          localBuffer.data[0] <- 42;
      }

      this.Buffer temp;

      void copyToTemp() {
          this.Buffer source;
          source.count <- 5;
          this.temp <- source;
      }
  }
  ```
- Verify transpiled C code correctly resolves the local variable type

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
