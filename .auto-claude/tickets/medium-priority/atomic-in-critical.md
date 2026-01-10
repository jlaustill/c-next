# Ticket: Atomic Modifier - Atomic in critical section

## Description
Write test for using atomic variables inside a critical block in C-Next.

## Test Category
Atomic Modifier

## Context Being Tested
Using atomic variables within a critical section, where interrupts are disabled. This tests the interaction between two concurrency mechanisms.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/atomic/atomic-in-critical.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for atomic In critical section
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare an atomic variable
- Access and modify it inside a critical block
- Test both read and compound assignment operations within critical
- Verify the transpiled C code handles both atomic operations and interrupt disabling correctly
- Consider whether atomic operations inside critical are redundant (should still compile)
- Example:
  ```
  atomic u32 sharedCounter <- 0;

  fn updateCounter() -> void {
      critical (sharedCounter) {
          sharedCounter +<- 1;
          // More complex logic that requires atomicity
      }
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
