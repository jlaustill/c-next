# Ticket: Volatile Modifier - With Const

## Description
Write test for combining volatile and const modifiers in C-Next.

## Test Category
Modifiers - Volatile

## Context Being Tested
Using volatile together with const modifier on variable declarations. This is valid for read-only hardware registers that can change externally.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/modifiers/volatile-with-const.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for volatile With const
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare a variable with both volatile and const modifiers
- Example syntax: `const volatile u32 hwStatusReg <- 0;`
- Verify transpiled C code includes both `const` and `volatile` keywords
- The order in C should be `const volatile uint32_t` or `volatile const uint32_t`
- Use case: read-only hardware status registers that change without software writing to them

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
