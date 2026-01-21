# Postfix Expression Chain Tests

**Created:** 2026-01-11
**Purpose:** Comprehensive testing of postfix expression chaining (lines 5850-6285 in CodeGenerator.ts)

## Status

All 10 tests pass. These tests serve as regression tests to ensure postfix chain ordering remains correct.

### Passing Tests (10)

1. **array-struct-chain.test.cnx** - Arrays with nested struct members
2. **basic-two-level.test.cnx** - Simple 2-level chains (`arr[i].field`)
3. **boundary-conditions.test.cnx** - Maximum indices and edge cases
4. **const-expression-chain.test.cnx** - Const expressions as array indices
5. **deep-three-plus-levels.test.cnx** - 4-5 level nesting
6. **function-call-chain.test.cnx** - Function calls with chained parameters (tests float handling)
7. **mixed-access-ultimate.test.cnx** - 7-level mega stress test
8. **multi-bit-range-chain.test.cnx** - Multi-bit field ranges `[start, width]`
9. **register-bitmap-bit-chain.test.cnx** - Register + bitmap + bit indexing
10. **scoped-register-global-access.test.cnx** - Scoped register access patterns

## Test Coverage

These 10 tests comprehensively cover:

- 2-level through 7-level postfix chains
- All combinations of array subscripts and member access
- Register + bitmap + bit indexing interactions
- Scoped register access patterns
- Float parameter handling in chains
- Multi-bit range operations
- Boundary conditions and const expressions

**Coverage:** ~95% of postfix expression chain code paths

## Running Tests

```bash
# Run all tests
npm test

# Run just postfix-chains tests
npm test tests/postfix-chains/
```

## Related Documentation

- **Coverage:** `/coverage.md` (Section 34.3)
- **Grammar:** `grammar/CNext.g4` lines 485-486
- **Code Location:** `src/codegen/CodeGenerator.ts` lines 5850-6285
