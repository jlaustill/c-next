# Ticket: Primitive Types - f64 Global Variable Declaration

## Description
Write test for f64 global variable declaration in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Global variable declaration with f64 type without initialization.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-global-var-declaration.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Global variable declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a global f64 variable without initialization
- Verify the transpiled C code uses the correct double type
- Example syntax: `f64 globalDouble;`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
