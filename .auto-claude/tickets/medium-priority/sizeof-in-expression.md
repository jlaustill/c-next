# Ticket: sizeof Operator - In Expression

## Description
Write test for sizeof operator used within an arithmetic expression in C-Next.

## Test Category
sizeof Operator

## Context Being Tested
Using sizeof as part of a larger expression, such as arithmetic or comparisons.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/sizeof/in-expression.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for sizeof In expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Use sizeof in an arithmetic expression
- Example: `u32 count <- total_bytes / sizeof(u32);`
- Example: `u32 offset <- index * sizeof(MyStruct);`
- Verify transpiled C code preserves the expression with sizeof

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
