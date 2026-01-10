# Ticket: Primitive Types - f64 Global Variable with Init

## Description
Write test for f64 global variable declaration with initialization in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Global variable declaration with f64 type with initial value.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-global-var-with-init.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Global variable with init
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a global f64 variable with initialization
- Verify the transpiled C code uses the correct double type and value
- Example syntax: `f64 globalDouble <- 3.14159265358979;`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
