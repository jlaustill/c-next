# Ticket: Control Flow - Critical Block Inside If Statement

## Description
Write test for critical block placed inside an if statement in C-Next.

## Test Category
Control Flow - Critical Block

## Context Being Tested
Critical block nested within an if or if-else statement branch.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/critical/critical-in-if.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Critical in if
- [ ] Jest test runner passes

## Test Implementation Notes
- Place a critical block inside an if statement branch
- Optionally place different critical operations in if and else branches
- Example syntax:
  ```
  atomic u32 counter;
  bool needsUpdate;

  if (needsUpdate) {
      critical (counter) {
          counter +<- 1;
      }
  }
  ```
- Verify transpiled C code correctly handles conditional critical section entry
- Test both simple if and if-else variations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
