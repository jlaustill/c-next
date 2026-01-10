# Ticket: Expression Contexts - Ternary in Array Index

## Description
Write test for using ternary expressions as array indices in C-Next.

## Test Category
Expression Contexts - Nested/Complex Expressions

## Context Being Tested
Using a ternary operator expression to compute an array index dynamically.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/ternary-in-array-index.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Ternary in array index"
- [ ] Jest test runner passes

## Test Implementation Notes
- Define an array with multiple elements
- Use a ternary expression to compute the index for array access
- Example syntax: `array[(condition) ? index1 : index2]`
- Test both read and write operations with ternary indices
- Verify correct element is accessed based on condition
- Verify transpiled C code correctly handles the ternary as an index

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
