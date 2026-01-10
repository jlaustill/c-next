# Ticket: NULL Interop - NULL in Ternary Condition

## Description
Write test for using NULL checks in ternary operator conditions in C-Next.

## Test Category
NULL Interop

## Context Being Tested
Using NULL comparisons (= NULL, != NULL) as the condition in a ternary operator to conditionally select values based on NULL status.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/null-check/null-in-ternary.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for NULL in ternary
- [ ] Jest test runner passes

## Test Implementation Notes
- Use a ternary operator with a NULL check as the condition
- Example: selecting a default value when result is NULL
- Example syntax: `u32 result <- (fgets(buffer, size, file) != NULL) ? 1 : 0;`
- Test both `!= NULL` and `= NULL` conditions in ternary
- Verify transpiled C code correctly handles NULL comparison in ternary condition
- Ensure proper C interop function usage (fgets, etc.)

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
