# Ticket: Type Casting - Enum to Integer Cast

## Description
Write test for casting enum values to integer types in C-Next.

## Test Category
Type Casting

## Context Being Tested
Explicitly casting an enum value to an integer type (u8, u16, u32, i32, etc.) to obtain its underlying numeric value.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/casting/enum-to-int.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Enum to int cast
- [ ] Jest test runner passes

## Test Implementation Notes
- Define an enum with explicit values
- Cast enum values to various integer types (u32, i32, etc.)
- Verify the cast syntax is explicit (C-Next likely requires explicit casts)
- Verify transpiled C code correctly extracts the underlying value
- Reference existing enum tests: `enum/basic-enum.cnx`, `enum/scoped-enum.cnx`
- Reference casting patterns: `casting/widening-unsigned.cnx`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
