# Ticket: Control Flow - Nested if Statement

## Description
Write test for nested if statements in C-Next.

## Test Category
Control Flow - if Statement

## Context Being Tested
Using if statements inside other if statements (nested conditionals).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/control-flow/if-nested.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Nested if
- [ ] Jest test runner passes

## Test Implementation Notes
- Create an if statement inside another if statement
- Test both true and false paths of outer/inner conditions
- Example:
  ```
  if (condition1) {
      if (condition2) {
          // nested code
      }
  }
  ```
- Verify correct C code generation with proper bracing

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
