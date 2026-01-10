# Ticket: Expression Contexts - Statement Nesting (critical inside if)

## Description
Write test for nesting a critical block inside an if statement in C-Next.

## Test Category
Expression Contexts - Statement Nesting

## Context Being Tested
Verify that critical blocks can be properly nested within if statements, ensuring correct scope handling and interrupt disabling code generation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/nesting-critical-in-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "critical inside if"
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a critical block inside an if statement body
- Test both true and false paths of the if condition
- Verify interrupt disable/enable is generated correctly
- Example:
  ```
  if (condition) {
      critical {
          // critical section code
          // interrupts disabled here
      }
  }
  ```
- Ensure proper C code generation with interrupt handling macros
- Verify critical section scoping is correct

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
