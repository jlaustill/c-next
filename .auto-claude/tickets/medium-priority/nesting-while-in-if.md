# Ticket: Expression Contexts - Statement Nesting (while inside if)

## Description
Write test for nesting a while loop inside an if statement in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that while loops can be properly nested within if statements, ensuring correct scope handling and C code generation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-while-in-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "while inside if"
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a while loop inside an if statement body
- Test both true and false paths of the if condition
- Verify break/continue work correctly within the nested while
- Example:
  ```
  if (condition) {
      while (loop_condition) {
          // loop body
      }
  }
  ```
- Ensure proper brace generation and indentation in C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
