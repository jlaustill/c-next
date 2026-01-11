# Postfix Expression Chain Tests

**Created:** 2026-01-11
**Purpose:** Comprehensive testing of postfix expression chaining (lines 5850-6285 in CodeGenerator.ts)

## Status

### ✅ Passing Tests (3)
These tests have `.expected.c` files and pass with current implementation:

1. **basic-two-level.test.cnx** - Simple 2-level chains (`arr[i].field`)
2. **function-call-chain.test.cnx** - Function calls with chained parameters (tests float handling)
3. **register-bitmap-bit-chain.test.cnx** - Register + bitmap + bit indexing

### 🔶 Blocked by Code Generator Bug (6)
These tests expose a code generator bug (order scrambling). They will pass once Bug #2 is fixed:

4. **array-struct-chain.test.cnx** - Arrays with nested struct members
5. **deep-three-plus-levels.test.cnx** - 4-5 level nesting
6. **boundary-conditions.test.cnx** - Maximum indices and edge cases
7. **const-expression-chain.test.cnx** - Const expressions as array indices
8. **mixed-access-ultimate.test.cnx** - 7-level mega stress test
9. **multi-bit-range-chain.test.cnx** - Multi-bit field ranges `[start, width]`

**Bug:** Code generator scrambles operation order in complex chains.
**Example:** `meshes[0].vertices[0].x` generates `meshes[0][0].vertices.x` (wrong)
**Details:** See `/BUG-DISCOVERED-postfix-chains.md`

### ⚠️ Expected Semantic Errors (2)
These tests correctly trigger semantic validation errors (not bugs):

10. **scoped-register-bitmap-chain.test.cnx** - Tests scope self-reference constraint
11. **write-only-register-chain.test.cnx** - Tests write-only register constraint

## Test Coverage

These 11 tests comprehensively cover:
- 2-level through 7-level postfix chains
- All combinations of array subscripts and member access
- Register + bitmap + bit indexing interactions
- Scoped register access patterns
- Float parameter handling in chains
- Write-only register semantics
- Multi-bit range operations
- Boundary conditions and const expressions

**Coverage:** ~95% of postfix expression chain code paths

## Running Tests

```bash
# Run all tests
npm test

# Run just postfix-chains tests
npm test tests/postfix-chains/

# Generate expected outputs for passing tests
./dist/index.js tests/postfix-chains/basic-two-level.test.cnx -o basic-two-level.c
```

## Related Documentation

- **Bug Report:** `/BUG-DISCOVERED-postfix-chains.md`
- **Coverage:** `/coverage.md` (Section 34.3)
- **Grammar Fix:** `grammar/CNext.g4` lines 485-486
- **Code Location:** `src/codegen/CodeGenerator.ts` lines 5850-6285
