# Ticket: Expression Contexts - Statement Nesting (switch inside if)

## Description
Write test for nesting a switch statement inside an if statement in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that switch statements can be properly nested within if statements, ensuring correct scope handling and C code generation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-switch-in-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "switch inside if"
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a switch statement inside an if statement body
- Test both true and false paths of the if condition
- Verify case labels and default work correctly
- Example:
  ```
  if (condition) {
      switch (value) {
          case 1 { /* case body */ }
          case 2 { /* case body */ }
          default { /* default body */ }
      }
  }
  ```
- Ensure proper brace generation and indentation in C output
- Test that switch-specific break behavior is maintained

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
