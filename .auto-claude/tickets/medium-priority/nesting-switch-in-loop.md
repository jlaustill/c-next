# Ticket: Expression Contexts - Statement Nesting (switch inside loop)

## Description
Write test for nesting a switch statement inside a loop (while or for) in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that switch statements can be properly nested within loops, ensuring correct scope handling and C code generation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-switch-in-loop.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "switch inside loop"
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a switch statement inside a while or for loop body
- Verify case execution over multiple loop iterations
- Test that loop continues after switch completes
- Example:
  ```
  while (loop_condition) {
      switch (value) {
          case 1 { /* handle case 1 */ }
          case 2 { /* handle case 2 */ }
          default { /* default action */ }
      }
  }
  ```
- Ensure proper brace generation and indentation in C output
- Test interaction between switch break and loop continue

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
