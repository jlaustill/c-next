# Ticket: Scope Declaration - Scope with Structs

## Description
Write test for declaring struct types within a scope declaration in C-Next.

## Test Category
Scope Declaration

## Context Being Tested
Declaring struct types inside a scope block and using them with appropriate scoped access.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/scope-with-structs.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Scope with structs
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a struct type inside a scope block
- Instantiate and use the struct with proper scoped access
- Example syntax:
  ```
  scope DeviceScope {
      struct Config {
          u32 baudRate;
          u8 address;
      }

      this.Config settings;

      void init() {
          this.settings.baudRate <- 9600;
          this.settings.address <- 0x50;
      }
  }
  ```
- Verify transpiled C code correctly handles scoped struct declarations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
