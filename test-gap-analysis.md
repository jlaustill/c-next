# Test File Gap Analysis

## Summary

- **Coverage.md claims**: 225 test files
- **Actual test files**: 251 files
- **Gap**: 26 files

## Breakdown of the 26-File Gap

### 1. Float Tests (10 files) - COMPLETELY MISSING

These tests exist but are NOT mentioned anywhere in coverage.md:

1. `tests/floats/f32-all-contexts.test.cnx` (825 bytes)
2. `tests/floats/f64-all-contexts.test.cnx` (890 bytes)
3. `tests/floats/float-arithmetic.test.cnx` (1,319 bytes)
4. `tests/floats/float-comparison.test.cnx` (1,745 bytes)
5. `tests/floats/float-arrays.test.cnx` (1,068 bytes)
6. `tests/floats/float-literals.test.cnx` (1,009 bytes)
7. `tests/floats/float-division-by-zero.test.cnx` (1,088 bytes)
8. `tests/floats/float-const-zero-valid.test.cnx` (501 bytes)
9. `tests/floats/float-int-conversion.test.cnx` (851 bytes)
10. `tests/floats/float-modulo-error.test.cnx` (299 bytes) - ERROR test

**Created**: Jan 10, 21:08 (after coverage.md was last updated)
**Impact**: ~40+ coverage.md rows should be updated from `[ ]` to `[x]`

### 2. Recent Arithmetic Tests (6 files)

Likely added as part of ADR-051 (const zero detection):

1. `tests/arithmetic/safe-div-all-types.test.cnx` (2,207 bytes) - comprehensive
2. `tests/arithmetic/safe-div-basic.test.cnx` (1,048 bytes)
3. `tests/arithmetic/safe-div-preserve-on-error.test.cnx` (1,249 bytes)
4. `tests/arithmetic/safe-mod-basic.test.cnx` (1,399 bytes)
5. `tests/arithmetic/division-const-zero-formats.test.cnx` (377 bytes)
6. `tests/arithmetic/division-non-zero-const.test.cnx` (159 bytes)

### 3. Comprehensive Scope Tests (5 files)

Large multi-context tests:

1. `tests/scope/this-all-types.test.cnx` (2,802 bytes, 138 lines) - 11 primitive types
2. `tests/scope/global-all-types.test.cnx` (3,108 bytes, 138 lines) - 11 primitive types
3. `tests/scope/scope-method-contexts.test.cnx` (341 lines)
4. `tests/scope/scope-modifier-combos.test.cnx` (241 lines)
5. `tests/scope/scope-critical-section.test.cnx` (233 lines)

### 4. Other Recent Additions (~5 files)

Various tests added but not reflected in coverage.md stats:

1. `tests/atomic/atomic-volatile-error.test.cnx` (301 bytes) - ERROR test
2. `tests/scope/scope-wrap-modifier.test.cnx` (141 lines)
3. `tests/scope/scope-clamp-modifier.test.cnx` (112 lines)
4. `tests/scope/scope-atomic-modifier.test.cnx` (107 lines)
5. `tests/scope/scope-public-private.test.cnx` (104 lines)

## Validation Results

### Broken References

**Result**: NONE

All file paths referenced in coverage.md point to existing files.

### Orphaned Tests

**Result**: NONE (technically)

All test files are technically "mentioned" somewhere in coverage.md, BUT:

- **Float tests**: All exist but marked `[ ]` untested (INCORRECT)
- **Comprehensive tests**: Referenced once but cover 20+ rows (UNDERCOUNTED)

## Impact on Coverage.md

### Test Count Update (line 1516)

**Current**: "Current Test Count: 225 passing tests"

**Should be**: "Current Test Count: 251 test files (179 success tests + 72 error tests)"

### Test Category Table (lines 1540-1557)

**Missing row**:

```markdown
| floats | 10 | 2 |
```

Should be inserted between `multi-dim-arrays` and `switch`.

### Section-Specific Updates Needed

1. **Section 1.3** (Floating Point): 24 rows × 2 (f32 + f64) = ~24 rows to update
2. **Section 3** (Comparisons): ADD ~12 new float rows
3. **Section 4** (Arithmetic): ADD ~10 new float rows
4. **Section 22** (Type Casting): ADD ~6 new float conversion rows
5. **Section 32.2** (Float Literals): Update ~8 rows
6. **Section 30a** (Volatile): ADD implementation note

**Total rows affected**: ~60+ rows

## Conclusion

The 26-file gap is fully accounted for:

- 10 float tests (highest impact)
- 6 arithmetic tests (ADR-051)
- 5 comprehensive scope tests (multi-context)
- 5 miscellaneous recent additions

No tests are truly "orphaned" - all exist in the filesystem and most are implicitly covered by coverage.md structure, but the STATUS markers are incorrect (especially for floats).
