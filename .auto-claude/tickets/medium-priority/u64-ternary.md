# Ticket: Primitive Types - u64 in Ternary Expression

## Description
Write test for u64 in ternary expressions in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u64 values as the result of ternary (conditional) expressions.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-ternary.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 In ternary expression
- [ ] Jest test runner passes

## Test Implementation Notes
- Use u64 values as the true/false branches of ternary expressions
- Example syntax: `u64 result <- (condition) ? largeValueA : largeValueB;`
- Test with both literal and variable u64 values
- Verify transpiled C code correctly handles uint64_t in ternary

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
