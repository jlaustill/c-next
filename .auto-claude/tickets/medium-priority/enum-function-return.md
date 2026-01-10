# Ticket: Enum Declaration - Function Return

## Description
Write test for enum as function return type in C-Next.

## Test Category
Enum Declaration

## Context Being Tested
Using an enum type as the return type for a function.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/enum/enum-function-return.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Enum as function return"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define an enum type
- Create a function that returns the enum type
- Return different enum values based on logic
- Verify transpiled C code handles enum return correctly
- Example:
  ```
  enum Status {
      Success,
      Error,
      Pending
  }

  fn getStatus(bool ok) -> Status {
      return (ok) ? Status.Success : Status.Error;
  }

  fn main() -> void {
      Status s <- getStatus(true);
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
