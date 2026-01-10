# Ticket: Logical Operators - && Chained (a && b && c)

## Description
Write test for chained logical AND (&&) expressions in C-Next.

## Test Category
Logical Operators - AND (&&)

## Context Being Tested
Using multiple && operators chained together in a single expression: `a && b && c`.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/logical/logical-and-chained.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Chained (a && b && c)" under 6.1 AND (&&)
- [ ] Jest test runner passes

## Test Implementation Notes
- Create expressions with 3+ chained && operators
- Example syntax: `if (a > 0 && b > 0 && c > 0 && d > 0) { ... }`
- Test both in conditions and as standalone assignments
- Verify transpiled C code correctly handles chained logical AND operations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
