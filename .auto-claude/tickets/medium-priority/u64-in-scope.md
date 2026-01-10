# Ticket: Primitive Types - u64 in Scope Declaration

## Description
Write test for u64 in scope declaration in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Declaring u64 variables within a scope (namespace) block.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-in-scope.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 In scope declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a scope with u64 member variables
- Example syntax:
  ```
  scope Counter {
      u64 value <- 0;

      fn increment() -> void {
          this.value +<- 1;
      }
  }
  ```
- Test access via this.member and global.member syntax
- Verify transpiled C code correctly scopes the uint64_t variable

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
