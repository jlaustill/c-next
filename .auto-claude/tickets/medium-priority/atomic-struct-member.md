# Ticket: Atomic Modifier - Atomic as struct member

## Description
Write test for using the atomic modifier on struct member fields in C-Next.

## Test Category
Atomic Modifier

## Context Being Tested
Declaring atomic fields inside a struct definition to ensure thread-safe access to individual struct members.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/atomic/atomic-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for atomic As struct member
- [ ] Jest test runner passes

## Test Implementation Notes
- Define a struct with atomic member fields
- Create an instance and modify the atomic member
- Test compound assignment on atomic struct members
- Verify the transpiled C code uses atomic operations for member access
- Example:
  ```
  struct SharedState {
      atomic u32 counter;
      u32 nonAtomicValue;
  }

  SharedState state <- {0};
  state.counter +<- 1;  // Should be atomic
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
