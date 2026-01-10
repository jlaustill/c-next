# Ticket: Control Flow - Switch with Hex Literal Cases

## Description
Write test for switch statements with hexadecimal literal case values in C-Next.

## Test Category
Control Flow - Switch Statement

## Context Being Tested
Using hex literals (0x notation) as case values in switch statements.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/switch/switch-hex-cases.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Hex literal cases
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a switch statement with hex literal case values (e.g., 0x00, 0x0F, 0xFF)
- Test switching on register values or bit masks using hex notation
- Example syntax:
  ```
  switch (value) {
      case 0x00: { // handle zero }
      case 0x0F: { // handle mask }
      case 0xFF: { // handle max }
      default(3): { // handle other }
  }
  ```
- Verify transpiled C code correctly handles hex literals in case labels

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
