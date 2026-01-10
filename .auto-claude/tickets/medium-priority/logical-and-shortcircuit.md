# Ticket: Logical Operators - && Short-Circuit Evaluation

## Description
Write test for logical AND (&&) short-circuit evaluation in C-Next.

## Test Category
Logical Operators - AND (&&)

## Context Being Tested
Verifying that && correctly short-circuits: if the left operand is false, the right operand should not be evaluated.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/logical/logical-and-shortcircuit.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Short-circuit evaluation" under 6.1 AND (&&)
- [ ] Jest test runner passes

## Test Implementation Notes
- Create a function with side effects (e.g., increments a counter)
- Use && where left operand is false to verify right side function is not called
- Example: `if (false && sideEffectFunction()) { ... }` should not call sideEffectFunction
- Verify transpiled C code preserves short-circuit semantics

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
