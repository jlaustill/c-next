# Ticket: Expression Contexts - Statement Nesting (if inside if)

## Description
Write test for nesting an if statement inside another if statement in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that if statements can be properly nested within other if statements, ensuring correct scope handling and C code generation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-if-in-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "if inside if"
- [ ] Jest test runner passes

## Test Implementation Notes
- Create multiple levels of nested if statements
- Test with both true and false conditions at each level
- Verify else branches work correctly with nested ifs
- Example:
  ```
  if (outer_condition) {
      if (inner_condition) {
          // deeply nested code
      } else {
          // inner else branch
      }
  }
  ```
- Ensure proper brace generation and indentation in C output

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
