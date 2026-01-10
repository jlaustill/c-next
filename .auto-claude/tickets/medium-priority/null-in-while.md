# Ticket: NULL Interop - NULL in While Condition

## Description
Write test for using NULL checks in while loop conditions in C-Next.

## Test Category
NULL Interop

## Context Being Tested
Using NULL comparisons (= NULL, != NULL) as while loop conditions, typically for iterating through data until a NULL terminator is reached.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/null-check/null-in-while.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for NULL in while
- [ ] Jest test runner passes

## Test Implementation Notes
- Use a while loop with a NULL check condition
- Example: reading lines until fgets returns NULL
- Example syntax: `while (fgets(buffer, size, file) != NULL) { ... }`
- Test both `!= NULL` and `= NULL` conditions in while
- Verify transpiled C code correctly handles NULL comparison in loop condition
- Ensure proper C interop function usage (fgets, etc.)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
