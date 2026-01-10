# Ticket: Expression Contexts - Statement Nesting (while inside while)

## Description
Write test for nesting a while loop inside another while loop in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that while loops can be properly nested within other while loops, ensuring correct scope handling and C code generation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-while-in-while.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "while inside while"
- [ ] Jest test runner passes

## Test Implementation Notes
- Create nested while loops (inner while inside outer while)
- Test break/continue behavior in both inner and outer loops
- Verify loop variables are correctly scoped
- Example:
  ```
  while (outer_condition) {
      while (inner_condition) {
          // nested loop body
      }
  }
  ```
- Ensure proper brace generation and indentation in C output
- Test that inner loop termination doesn't affect outer loop

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
