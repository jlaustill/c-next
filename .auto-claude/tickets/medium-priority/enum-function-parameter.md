# Ticket: Enum Declaration - Function Parameter

## Description
Write test for enum as function parameter type in C-Next.

## Test Category
Enum Declaration

## Context Being Tested
Using an enum type as a parameter to a function.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/enum/enum-function-parameter.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Enum as function parameter"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define an enum type
- Create a function that takes the enum as a parameter
- Call the function with different enum values
- Verify transpiled C code handles enum parameter correctly
- Example:
  ```
  enum Color {
      Red,
      Green,
      Blue
  }

  fn printColor(Color c) -> void {
      switch (c) {
          case Color.Red: // ...
          case Color.Green: // ...
          case Color.Blue: // ...
      }
  }

  fn main() -> void {
      printColor(Color.Red);
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
