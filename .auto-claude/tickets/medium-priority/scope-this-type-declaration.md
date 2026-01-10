# Ticket: Scope Declaration - this.Type Declaration

## Description
Write test for declaring variables using this.Type syntax within a scope in C-Next.

## Test Category
Scope Declaration - Scoped Types

## Context Being Tested
Declaring a variable of a type defined in the current scope using the `this.Type` syntax.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/this-type-declaration.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for this.Type declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct or enum type inside a scope
- Declare a variable using `this.TypeName` syntax
- Example syntax:
  ```
  scope Device {
      struct Config {
          u32 baudRate;
          u8 address;
      }

      this.Config deviceConfig;

      void init() {
          this.deviceConfig.baudRate <- 115200;
          this.deviceConfig.address <- 0x42;
      }
  }
  ```
- Verify transpiled C code correctly resolves the scoped type reference

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
