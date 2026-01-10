# Ticket: Primitive Types - u16 in Bitwise Operation

## Description
Write test for u16 in bitwise operations in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u16 variables and literals in bitwise operations (&, |, ^, ~, <<, >>).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u16-bitwise-op.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u16 In bitwise operation
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare u16 variables and perform bitwise AND, OR, XOR, NOT
- Test left and right shift operations
- Example syntax: `u16 result <- a & b;` or `u16 masked <- value & 0x00FF;`
- Verify transpiled C code correctly handles 16-bit bitwise operations

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
