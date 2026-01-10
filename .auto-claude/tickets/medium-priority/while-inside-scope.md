# Ticket: Control Flow - while Loop Inside Scope

## Description
Write test for while loop inside a scope declaration in C-Next.

## Test Category
Control Flow - while Loop

## Context Being Tested
Using a while loop inside a scope block with this.member access.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/control-flow/while-inside-scope.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for While inside scope
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a scope with a variable and a function containing a while loop
- Use this.member to access scope variables in loop
- Example:
  ```
  scope Counter {
      u32 count <- 0;

      fn increment() -> void {
          while (this.count < 10) {
              this.count +<- 1;
          }
      }
  }
  ```
- Verify correct C code generation with proper namespace prefixing

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
