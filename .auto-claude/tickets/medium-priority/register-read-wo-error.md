# Ticket: Register Declaration - Read from wo Error

## Description
Write test for compiler error when reading from a write-only register field in C-Next.

## Test Category
Register Declaration - Error Handling

## Context Being Tested
Compiler error detection when attempting to read from a write-only (wo) register field.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/register/register-read-wo-error.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "Read from wo (ERROR)"
- [ ] Jest test runner passes

## Test Implementation Notes
- This is an ERROR test - it should verify the compiler correctly detects invalid reads
- Follow pattern from `tests/register/register-write-ro-error.cnx`
- Attempting to read from a write-only register should produce a compiler error
- This enforces hardware safety constraints (reading wo registers may return undefined values)
- Example syntax (should produce error):
  ```
  register PERIPH @ 0x50000000 {
      CMD:  u32 wo @ 0x00,  // Write-only command register
      DATA: u32 rw @ 0x04,  // Read-write data register
  }

  void main() {
      // This should be allowed
      PERIPH.CMD <- 0x01;

      // This should produce ERROR: cannot read from write-only register
      u32 value <- PERIPH.CMD;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
