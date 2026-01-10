# Ticket: Bit Indexing - Expression Index

## Description
Write test for bit indexing using an expression as the index in C-Next.

## Test Category
Bit Indexing

## Context Being Tested
Using an expression (arithmetic, function call, etc.) as the bit index in bit access operations.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bit-indexing/bit-index-expression.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for Expression index
- [ ] Jest test runner passes

## Test Implementation Notes
- Use arithmetic expression as index: `bool bit <- value[offset + 3];`
- Test with subtraction: `value[total - 1] <- true;`
- Test with more complex expressions: `value[base * 2 + 1]`
- Verify transpiled C code correctly evaluates the expression before computing bit mask

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
