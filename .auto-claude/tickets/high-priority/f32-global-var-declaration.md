# Ticket: Primitive Types - f32 Global Variable Declaration

## Description
Write test for f32 global variable declaration in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Global variable declaration with f32 type without initialization.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f32-global-var-declaration.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f32 Global variable declaration
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a global f32 variable without initialization
- Verify the transpiled C code uses the correct float type
- Example syntax: `f32 globalFloat;`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
