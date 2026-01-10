# Ticket: Struct Declaration - Function Return

## Description
Write test for struct as function return type in C-Next.

## Test Category
Struct Declaration

## Context Being Tested
Using a struct type as the return type for a function.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/structs/struct-function-return.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "As function return"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct type with members
- Create a function that returns the struct type
- Instantiate and populate a struct inside the function
- Return the struct instance
- Verify transpiled C code handles struct return correctly
- Example:
  ```
  struct Point {
      i32 x;
      i32 y;
  }

  fn makePoint(i32 x, i32 y) -> Point {
      Point p <- Point{x: x, y: y};
      return p;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
