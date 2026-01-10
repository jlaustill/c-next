# Ticket: Static Allocation - Static String Buffer

## Description
Write test for static string buffer allocation in C-Next.

## Test Category
Static Allocation

## Context Being Tested
Using statically allocated string buffers for fixed-size string storage without dynamic memory allocation.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/static-allocation/static-string-buffer.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Static string buffer
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a string with explicit capacity for static allocation
- Initialize and modify string contents within capacity
- Example syntax: `string<32> buffer <- "initial";`
- Verify transpiled C code uses stack-allocated char array
- Test should demonstrate no heap allocation needed

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
