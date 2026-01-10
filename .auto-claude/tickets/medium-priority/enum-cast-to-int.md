# Ticket: Enum Declaration - Cast to Integer

## Description
Write test for casting enum values to integer in C-Next.

## Test Category
Enum Declaration

## Context Being Tested
Explicitly casting an enum value to its underlying integer representation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/enum/enum-cast-to-int.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Cast to integer"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define an enum with explicit or auto-increment values
- Cast enum values to integer using explicit cast syntax
- Verify the integer value matches the expected enum value
- Verify transpiled C code handles cast correctly
- Example:
  ```
  enum Priority {
      Low <- 0,
      Medium <- 5,
      High <- 10
  }

  fn main() -> void {
      Priority p <- Priority.Medium;
      u32 value <- (u32)p;  // Should be 5
  }
  ```

## Related
- This is the inverse of "assign int to enum" which is an ERROR case
- See also: `tests/enum/enum-error-assign-int.cnx`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
