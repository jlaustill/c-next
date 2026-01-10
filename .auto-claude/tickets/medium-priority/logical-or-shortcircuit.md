# Ticket: Logical Operators - || Short-Circuit Evaluation

## Description
Write test for logical OR (||) short-circuit evaluation in C-Next.

## Test Category
Logical Operators - OR (||)

## Context Being Tested
Verifying that || correctly short-circuits: if the left operand is true, the right operand should not be evaluated.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/logical/logical-or-shortcircuit.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Short-circuit evaluation" under 6.2 OR (||)
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a function with side effects (e.g., increments a counter)
- Use || where left operand is true to verify right side function is not called
- Example: `if (true || sideEffectFunction()) { ... }` should not call sideEffectFunction
- Verify transpiled C code preserves short-circuit semantics

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
