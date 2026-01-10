# Ticket: Primitive Types - i16 Clamp Modifier

## Description
Write test for i16 with clamp (saturating) overflow modifier in C-Next.

## Test Category
Primitive Types - Signed Integers / Overflow Modifiers

## Context Being Tested
Using clamp modifier with i16 type to enable saturating arithmetic that clamps to min/max on overflow.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/primitives/i16-clamp.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for i16 With clamp modifier
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare clamp i16 variable
- Example syntax: `clamp i16 value <- 32000;`
- Test overflow scenario: adding to cause overflow should clamp to 32767
- Test underflow scenario: subtracting to cause underflow should clamp to -32768
- Verify transpiled C code includes saturation logic
- Reference existing patterns in `primitives/signed-overflow.cnx` and `primitives/clamp-declaration.cnx`

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
