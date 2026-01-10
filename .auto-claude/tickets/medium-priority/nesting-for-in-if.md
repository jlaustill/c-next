# Ticket: Expression Contexts - Statement Nesting (for inside if)

## Description
Write test for nesting a for loop inside an if statement in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that for loops can be properly nested within if statements, ensuring correct scope handling and C code generation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-for-in-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "for inside if"
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a for loop inside an if statement body
- Test both true and false paths of the if condition
- Verify loop counter variable is correctly scoped
- Example:
  ```
  if (condition) {
      for (u32 i <- 0; i < 10; i +<- 1) {
          // loop body
      }
  }
  ```
- Ensure proper brace generation and indentation in C output
- Test break/continue behavior within the nested for loop

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
