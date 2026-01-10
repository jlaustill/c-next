# Ticket: Primitive Types - u64 in Register Field

## Description
Write test for u64 as register field type in C-Next.

## Test Category
Primitive Types - Unsigned Integers

## Context Being Tested
Using u64 as the underlying type for register declarations in memory-mapped I/O contexts.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/u64-register-field.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for u64 In register field
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a register with u64 fields
- Example syntax:
  ```
  register SystemTimer @ 0x40000000 {
      rw u64 count;
      ro u64 status;
  }
  ```
- Test reading and writing to u64 register fields
- Verify transpiled C code uses volatile uint64_t pointers for register access

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
