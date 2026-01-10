# Ticket: Control Flow - Nested Critical Blocks

## Description
Write test for nested critical blocks in C-Next.

## Test Category
Control Flow - Critical Block

## Context Being Tested
Critical block containing another critical block (if allowed, or error if not).

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/critical/critical-nested.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Nested critical
- [ ] Jest test runner passes

## Test Implementation Notes
- Attempt to create a critical block inside another critical block
- Determine if this is valid syntax or should produce an error
- If valid, verify proper interrupt disable/enable nesting
- Example syntax:
  ```
  critical (outerVar) {
      // outer critical section
      critical (innerVar) {
          // inner critical section - does this work?
      }
  }
  ```
- If this should be an error, verify the compiler produces a meaningful error message

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
