# Ticket: Primitive Types - u64 in Bitwise Operation

## Description
Write test for u64 in bitwise operations in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u64 values in bitwise operations (&, |, ^, ~, <<, >>).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-bitwise-op.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 In bitwise operation
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare u64 variables and perform bitwise operations
- Test AND, OR, XOR, NOT, left shift, and right shift
- Example syntax: `u64 mask <- a & b;`
- Use values that span all 64 bits to verify correct handling
- Verify transpiled C code correctly handles uint64_t bitwise operations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
