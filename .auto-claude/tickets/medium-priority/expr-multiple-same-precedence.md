# Ticket: Expression Contexts - Multiple Operators Same Precedence

## Description
Write test for expressions with multiple operators of the same precedence level in C-Next.

## Test Category
Expression Contexts - Nested/Complex Expressions

## Context Being Tested
Using multiple operators with the same precedence in a single expression to verify left-to-right evaluation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/expression-contexts/multiple-same-precedence.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Multiple operators same precedence"
- [ ] Jest test runner passes

## Test Implementation Notes
- Test arithmetic operators at same precedence: `a + b - c + d`
- Test multiplicative operators: `a * b / c * d`
- Test comparison chaining: `a < b` followed by other same-precedence ops
- Test bitwise operators at same precedence: `a & b & c`
- Verify left-to-right associativity is maintained
- Verify transpiled C code preserves correct evaluation order
- Consider adding parentheses tests to confirm precedence handling

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
