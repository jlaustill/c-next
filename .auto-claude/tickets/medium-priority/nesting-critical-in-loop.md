# Ticket: Expression Contexts - Statement Nesting (critical inside loop)

## Description
Write test for nesting a critical block inside a loop (while or for) in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that critical blocks can be properly nested within loops, ensuring correct scope handling and interrupt disabling code generation over multiple iterations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-critical-in-loop.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "critical inside loop"
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a critical block inside a while or for loop body
- Verify critical section executes correctly on each iteration
- Test that interrupts are properly disabled/enabled per iteration
- Example:
  ```
  while (loop_condition) {
      critical {
          // critical section code
          // interrupts disabled each iteration
      }
  }
  ```
- Ensure proper C code generation with interrupt handling macros
- Verify critical section entry/exit happens correctly per loop iteration

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
