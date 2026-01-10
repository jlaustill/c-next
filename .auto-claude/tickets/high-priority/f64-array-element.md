# Ticket: Primitive Types - f64 Array Element Type

## Description
Write test for f64 as an array element type in C-Next.

## Test Category
Primitive Types - Floating Point

## Context Being Tested
Array with f64 element type.

## Priority
High

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/f64-array-element.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for f64 Array element type
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare an array of f64 values
- Test array initialization, access, and assignment
- Verify the transpiled C code correctly declares the double array
- Example syntax:
  ```
  f64[4] preciseMeasurements <- [1.0, 2.5, 3.7, 4.2];
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
