# Ticket: Callbacks - Array of Callbacks

## Description
Write test for array of callback types in C-Next.

## Test Category
Callbacks

## Context Being Tested
Declaring and using an array of callback types, allowing multiple callback functions to be stored and invoked.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/callbacks/callback-array.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Array of callbacks
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a callback type
- Create an array of that callback type
- Assign different function implementations to array elements
- Invoke callbacks through array indexing
- Example syntax:
  ```
  callback void Handler();
  Handler[3] handlers;
  handlers[0] <- myHandler1;
  handlers[1] <- myHandler2;
  handlers[0]();
  ```
- Verify transpiled C code correctly handles function pointer arrays

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
