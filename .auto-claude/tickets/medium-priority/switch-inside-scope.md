# Ticket: Control Flow - Switch Inside Scope

## Description
Write test for switch statement placed inside a scope declaration in C-Next.

## Test Category
Control Flow - Switch Statement

## Context Being Tested
Switch statement nested within a scope block, potentially using this.member or scope variables.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/switch/switch-inside-scope.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Switch inside scope
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a scope with a member variable and a function containing a switch
- The switch should use this.member as the switch expression or within cases
- Example syntax:
  ```
  scope MyScope {
      u32 state;

      void handleState() {
          switch (this.state) {
              case 0: { // handle state 0 }
              case 1: { // handle state 1 }
              case 2: { // handle state 2 }
              default(remaining): { // handle other states }
          }
      }
  }
  ```
- Verify transpiled C code correctly handles switch with scoped member access

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
