# Ticket: Control Flow - for Loop Inside Scope

## Description
Write test for for loop inside a scope declaration in C-Next.

## Test Category
Control Flow - for Loop

## Context Being Tested
Using a for loop inside a scope block with this.member access.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/for-loops/for-inside-scope.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for For inside scope
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a scope with variables and a function containing a for loop
- Use this.member to access scope variables in loop
- Example:
  ```
  scope ArrayProcessor {
      u32[10] data;
      u32 sum <- 0;

      fn computeSum() -> void {
          for (u32 i <- 0; i < this.data.length; i +<- 1) {
              this.sum +<- this.data[i];
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
