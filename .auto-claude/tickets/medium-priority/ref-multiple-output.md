# Ticket: References - Multiple Output Parameters

## Description
Write test for functions with multiple output parameters (pass-by-reference) in C-Next.

## Test Category
References (Pass-by-reference)

## Context Being Tested
Using multiple reference parameters as output parameters, allowing a function to return multiple values through its parameters.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/references/multiple-output-params.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Multiple output params
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a function with 2+ reference parameters for output
- Function should compute and assign values to all output parameters
- Verify all outputs are correctly populated after function call
- Example: `fn divmod(u32 a, u32 b, ref u32 quotient, ref u32 remainder) -> void`
- Test with different combinations of input and output parameters
- Verify transpiled C code correctly handles multiple pointer parameters

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
