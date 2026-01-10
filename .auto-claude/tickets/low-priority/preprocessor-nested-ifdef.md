# Ticket: Preprocessor - Nested #ifdef

## Description
Write test for nested #ifdef preprocessor directives in C-Next.

## Test Category
Preprocessor

## Context Being Tested
Nested #ifdef / #endif directives for conditional compilation with multiple levels.

## Priority
Low

## Acceptance Criteria
- [ ] Test file created in `tests/preprocessor/nested-ifdef.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Nested #ifdef
- [ ] Jest test runner passes

## Test Implementation Notes
- Test nested conditional compilation with #ifdef inside another #ifdef block
- Verify the transpiler correctly handles multiple nesting levels
- Example syntax:
  ```
  #define OUTER
  #define INNER

  #ifdef OUTER
    // outer block
    #ifdef INNER
      // inner block
    #endif
  #endif
  ```
- Consider testing both defined and undefined combinations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
