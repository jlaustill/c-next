# Ticket: Control Flow - Nested Switch Statements

## Description
Write test for nested switch statements in C-Next.

## Test Category
Control Flow - Switch Statement

## Context Being Tested
Switch statement containing another switch statement within a case block.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/switch/switch-nested.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Nested switch
- [ ] Jest test runner passes

## Test Implementation Notes
- Create an outer switch with an inner switch inside a case block
- Both switches should have multiple cases
- Test that the inner switch executes correctly based on outer switch path
- Example syntax:
  ```
  switch (outer) {
      case 1: {
          switch (inner) {
              case 10: { // handle (1, 10) }
              case 20: { // handle (1, 20) }
              default(remaining): { // handle (1, other) }
          }
      }
      case 2: { // handle case 2 }
      default(remaining): { // handle other }
  }
  ```
- Verify transpiled C code correctly handles nested switch scoping

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
