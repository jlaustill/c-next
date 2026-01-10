# Ticket: Volatile Modifier - Register Field (Implied)

## Description
Write test for volatile behavior on register field declarations in C-Next.

## Test Category
Modifiers - Volatile

## Context Being Tested
Testing that register declarations in C-Next have implied volatile semantics, as hardware registers are inherently volatile.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/modifiers/volatile-register.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for volatile Register field (implied)
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a register type with fields
- Verify that the transpiled C code treats register fields as volatile
- Example syntax:
  ```
  register8 StatusReg @ 0x1000 {
      rw ready: 0;
      rw busy: 1;
      ro error: 2..4;
  }
  ```
- Register fields should be implicitly volatile since they map to hardware
- Verify the generated C code has appropriate volatile qualifiers

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
