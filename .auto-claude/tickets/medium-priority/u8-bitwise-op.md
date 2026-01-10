# Ticket: Primitive Types - u8 in Bitwise Operation

## Description
Write test for u8 in bitwise operations in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u8 variables and literals in bitwise operations (&, |, ^, ~, <<, >>).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u8-bitwise-op.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u8 In bitwise operation
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare u8 variables and perform bitwise AND, OR, XOR, NOT
- Test left and right shift operations
- Example syntax: `u8 result <- a & b;` or `u8 masked <- value & 0x0F;`
- Verify transpiled C code correctly handles 8-bit bitwise operations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
