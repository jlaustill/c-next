# Ticket: Callbacks - Callback as Struct Member

## Description
Write test for callback type as a struct member in C-Next.

## Test Category
Callbacks

## Context Being Tested
Using a callback type as a member field within a struct declaration.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/callbacks/callback-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Callback as struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a callback type
- Create a struct with the callback as a member
- Assign a function to the struct's callback member
- Invoke the callback through struct member access
- Example syntax:
  ```
  callback u32 Calculator(u32 a, u32 b);

  struct EventHandler {
      Calculator onCalculate;
      u32 value;
  }

  EventHandler handler;
  handler.onCalculate <- myAddFunction;
  u32 result <- handler.onCalculate(5, 3);
  ```
- Verify transpiled C code correctly handles function pointer struct members

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
