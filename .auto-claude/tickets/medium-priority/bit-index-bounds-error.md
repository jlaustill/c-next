# Ticket: Bit Indexing - Out of Bounds Index (ERROR)

## Description
Write error test for bit indexing with out-of-bounds index in C-Next.

## Test Category
Bit Indexing

## Context Being Tested
Compiler should produce an error when bit index exceeds the type's bit width (e.g., accessing bit 32 of a u32, or bit 8 of a u8).

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bit-indexing/bit-index-bounds-error.cnx`
- [ ] Test correctly triggers compiler error
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Out of bounds index (ERROR)
- [ ] Jest test runner passes (error is expected)

## Test Implementation Notes
- Attempt to access bit beyond type width: `u8 val <- 0; bool bit <- val[8];` (u8 only has bits 0-7)
- Test for u16: `u16 val <- 0; bool bit <- val[16];` (u16 only has bits 0-15)
- Test for u32: `u32 val <- 0; bool bit <- val[32];` (u32 only has bits 0-31)
- Verify compiler produces a clear error message about out-of-bounds bit access
- This is an ERROR test - it should NOT compile successfully

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
