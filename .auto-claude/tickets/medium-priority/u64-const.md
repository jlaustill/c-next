# Ticket: Primitive Types - u64 with const Modifier

## Description
Write test for u64 with const modifier in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Declaring const u64 variables that cannot be modified after initialization.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-const.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 With const modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a const u64 variable with initialization
- Example syntax: `const u64 MAX_VALUE <- 18446744073709551615;`
- Verify the value can be read but not modified
- Verify transpiled C code uses `const uint64_t`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
