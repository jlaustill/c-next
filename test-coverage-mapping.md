# Test-to-Coverage Mapping Document

This document maps each test file to the specific coverage.md sections and rows it covers.

## Float Tests Coverage Map

### 1. floats/f32-all-contexts.test.cnx (825 bytes)

**Covers Section 1.3 - f32 (lines 247-260):**
- [x] Global variable declaration (line 4: `f32 global_f <- 3.14`)
- [x] Global variable with init (line 4)
- [x] Local variable declaration (line 23: `f32 local <- 2.5`)
- [x] Local variable with init (line 23)
- [x] Function parameter (line 17: `f32 add(f32 a, f32 b)`)
- [x] Function return type (line 17: `f32 add(...)`)
- [x] Struct member (line 9: `f32 x;`)
- [x] Array element type (line 14: `f32 samples[4]`)
- [x] In arithmetic expression (line 31: `x + 5.0 - 2.0`)
- [x] In comparison (line 38: `a < b`)
- [x] In ternary expression (line 45: `(a > b) ? a : b`)

**Also covers:**
- Section 4.1 (Addition): f32 + f32 (line 31)
- Section 4.2 (Subtraction): f32 - f32 (line 31)
- Section 3.3 (Less Than): f32 < f32 (line 38)
- Section 8 (Ternary Operator): With f32 (line 45)

---

### 2. floats/f64-all-contexts.test.cnx (890 bytes)

**Covers Section 1.3 - f64 (lines 264-277):**
- [x] Global variable declaration (line 4: `f64 global_d`)
- [x] Global variable with init (line 4)
- [x] Local variable declaration (line 24: `f64 local`)
- [x] Local variable with init (line 24)
- [x] Function parameter (line 18: `f64 multiply(f64 a, f64 b)`)
- [x] Function return type (line 18)
- [x] Struct member (line 9: `f64 x;`)
- [x] Array element type (line 15: `f64 measurements[8]`)
- [x] In arithmetic expression (line 32: `x * 2.5 / 5.0`)
- [x] In comparison (line 39: `a <= b`)
- [x] In ternary expression (line 46: `(a < b) ? a : b`)

**Also covers:**
- Section 4.3 (Multiplication): f64 * f64
- Section 4.4 (Division): f64 / f64
- Section 3.6 (Less Than or Equal): f64 <= f64
- Section 3.3 (Less Than): f64 < f64

---

### 3. floats/float-arithmetic.test.cnx (1,319 bytes)

**Covers Section 4 - Arithmetic Operators:**

**Section 4.1 (Addition):**
- [x] f32 + f32 (line 10: `a + b`)
- [x] f64 + f64 (line 36: `x + y`)
- [x] f32 + literal (line 22: `a + 5.0`)
- [x] f64 + literal (line 48: `x + 10.0`)

**Section 4.2 (Subtraction):**
- [x] f32 - f32 (line 13: `a - b`)
- [x] f64 - f64 (line 39: `x - y`)
- [x] Unary negation f32 (line 28: `-a`)
- [x] Unary negation f64 (line 54: `-x`)

**Section 4.3 (Multiplication):**
- [x] f32 * f32 (line 16: `a * b`)
- [x] f64 * f64 (line 42: `x * y`)
- [x] f32 * literal (line 24: `a * 2.0`)
- [x] f64 * literal (line 50: `x * 1.5`)

**Section 4.4 (Division):**
- [x] f32 / f32 (line 19: `a / b`)
- [x] f64 / f64 (line 45: `x / y`)
- [x] f32 / literal (line 25: `a / 2.0`)
- [x] f64 / literal (line 51: `x / 4.0`)

**Section 34.1 (Complex Expressions):**
- [x] Multiple operations (line 64: `a + b * c`)
- [x] Parenthesized sub-expressions (line 65: `(a + b) * c`)

---

### 4. floats/float-comparison.test.cnx (1,745 bytes)

**Covers Section 3 - Comparison Operators:**

**Section 3.1 (Equality):**
- [x] f32 = f32 (line 11: `a = c`)
- [x] f64 = f64 (line 43: `x = z`)
- [x] Float = Literal (line 70: `a = 3.14`)

**Section 3.2 (Not Equal):**
- [x] f32 != f32 (line 15: `a != b`)
- [x] f64 != f64 (line 47: `x != y`)
- [x] Float != Literal (line 71: `a != 3.14`)

**Section 3.3 (Less Than):**
- [x] f32 < f32 (line 19: `b < a`)
- [x] f64 < f64 (line 51: `y < x`)
- [x] Float < Literal (line 72: `a < 10.0`)

**Section 3.4 (Greater Than):**
- [x] f32 > f32 (line 23: `a > b`)
- [x] f64 > f64 (line 55: `x > y`)
- [x] Float > Literal (line 73: `a > 1.0`)

**Section 3.5 (Less Than or Equal):**
- [x] f32 <= f32 (line 27: `b <= a`)
- [x] f64 <= f64 (line 59: `y <= x`)
- [x] Float <= Literal (line 74: `a <= 3.14`)

**Section 3.6 (Greater Than or Equal):**
- [x] f32 >= f32 (line 32: `a >= b`)
- [x] f64 >= f64 (line 63: `x >= y`)
- [x] Float >= Literal (line 75: `a >= 3.14`)

**Section 7.1 (if Statement):**
- [x] Comparison in if condition (line 81: `if (temp > 30.0)`)

**Section 7.2 (while Loop):**
- [x] Comparison in while condition (line 89: `while (temp < 100.0)`)

---

### 5. floats/float-arrays.test.cnx (1,068 bytes)

**Covers Section 16.1 (Arrays):**
- [x] f32 array declaration (line 3: `f32 samples_f32[10]`)
- [x] f64 array declaration (line 4: `f64 measurements_f64[5]`)
- [x] Array element access (line 13: `samples_f32[0]`)
- [x] Array element assignment (line 8: `samples_f32[0] <- 1.1`)
- [x] Arithmetic with array elements (line 17: `samples_f32[0] + samples_f32[1]`)
- [x] Array in for loop (lines 21-23)
- [x] Array with initializer (line 42: `f32 coords[3] <- [0.0, 1.0, 2.0]`)

**Also covers Section 1.3:**
- Array element type for f32
- Array element type for f64

---

### 6. floats/float-literals.test.cnx (1,009 bytes)

**Covers Section 32.2 (Float Literals):**

**f32:**
- [x] Decimal (line 5: `3.14`)
- [x] Scientific notation (line 17: `1.5e-10`, line 18: `3.0e8`)
- [x] Negative decimal (line 28: `-3.14`)
- [x] Negative scientific (line 29: `-1.5e10`)
- [x] Zero (line 37: `0.0`)
- [x] Edge cases (line 41: `1.192092896e-7`, line 44: `3.402823466e38`)

**f64:**
- [x] Decimal (line 10: `3.141592653589793`)
- [x] Scientific notation (line 22: `2.5e-100`, line 23: `1.7e100`)
- [x] Negative decimal (line 31: `-99.99`)
- [x] Negative scientific (line 32: `-2.5e-50`)

---

### 7. floats/float-division-by-zero.test.cnx (1,088 bytes)

**Covers Section 4.4 (Division):**
- [x] f32 division by zero literal (line 11: `x / 0.0`) - produces infinity
- [x] f32 division by zero variable (line 14: `x / zero`) - produces infinity
- [x] f64 division by zero literal (line 26: `y / 0.0`)
- [x] f64 division by zero variable (line 29: `y / zero`)
- [x] Zero divided by zero (line 39: `0.0 / 0.0`) - produces NaN

**NEW ROW NEEDED:**
- Float division by zero valid (NOT an error like integers)

---

### 8. floats/float-const-zero-valid.test.cnx (501 bytes)

**Covers Section 4.4 (Division) - ADR-051 exemption:**
- [x] Division by const zero is VALID for floats (line 9: `10.0 / ZERO`)
- [x] Const zero detection does NOT apply to floats (unlike integers)

**Related to:**
- Section 19 (Const Modifier) - const with floats
- ADR-051 implementation - float exemption from const zero detection

---

### 9. floats/float-int-conversion.test.cnx (851 bytes)

**Covers Section 22 (Type Casting):**
- [x] Integer to f32 (implicit) (line 6: `f32 float_val <- int_val`)
- [x] Integer to f64 (implicit) (line 12: `f64 double_val <- int_val`)
- [x] f32 to f64 widening (line 23: `f64 precise <- single`)
- [x] f32 to integer (explicit cast) (line 29: `i32 truncated <- (i32)a`)
- [x] f64 to integer (explicit cast) (line 32: `u32 unsigned_val <- (u32)b`)
- [x] f64 to f32 narrowing (explicit cast) (line 36: `f32 small <- (f32)big`)

**NEW ROWS NEEDED in Section 22:**
- Integer to float conversion (implicit widening)
- Float to integer conversion (explicit cast, truncation)
- f32 to f64 conversion (implicit widening)
- f64 to f32 conversion (explicit narrowing)

---

### 10. floats/float-modulo-error.test.cnx (299 bytes) - ERROR TEST

**Covers Section 4.5 (Modulo):**
- [x] Float modulo **(ERROR)** - confirms % operator rejected for floats (line 9: `a % b`)

**NEW ROW in Section 4.5:**
- Float modulo **(ERROR)** - `floats/float-modulo-error.test.cnx`

---

## Comprehensive Type Tests Coverage Map

### 11. scope/this-all-types.test.cnx (2,802 bytes, 138 lines)

**Covers Section 13 (Scope Declaration):**
- [x] Scope with variables (lines 6-23: all 11 primitive types)
- [x] Scope with functions (lines 26-71: getter methods for all types)
- [x] this.member access (lines 27, 31, 35, etc.)
- [x] this.member assignment (lines 75, 79, 83: setter methods)

**Covers Section 1 (Primitive Types) - "In scope declaration" row:**
- [x] u8 in scope (line 7)
- [x] u16 in scope (line 8)
- [x] u32 in scope (line 9)
- [x] u64 in scope (line 10)
- [x] i8 in scope (line 13)
- [x] i16 in scope (line 14)
- [x] i32 in scope (line 15)
- [x] i64 in scope (line 16)
- [x] f32 in scope (line 19)
- [x] f64 in scope (line 20)
- [x] bool in scope (line 23)

---

### 12. scope/global-all-types.test.cnx (3,108 bytes, 138 lines)

**Covers Section 13 (Scope Declaration):**
- [x] global.member access (lines 27, 31, 35, etc.)
- [x] global.member assignment (lines 75, 79, 83)

**Covers Section 1 (Primitive Types) - Global declarations:**
- Tests that global primitives work with global. accessor from inside scopes

---

## Statistics Reconciliation

**Test File Count Breakdown (from inventory):**

| Directory          | Files | Error Tests | Notes                              |
|--------------------|-------|-------------|------------------------------------|
| string             | 21    | 6           | Documented in coverage.md          |
| scope              | 21    | 5           | **Comprehensive tests included**   |
| casting            | 13    | 8           | Documented in coverage.md          |
| arithmetic         | 12    | 3           | **Includes recent safe-div tests** |
| multi-dim-arrays   | 11    | 1           | Documented in coverage.md          |
| **floats**         | **10**| **2**       | **COMPLETELY MISSING FROM STATS**  |
| switch             | 9     | 5           | Documented in coverage.md          |
| null-check         | 9     | 5           | Documented in coverage.md          |
| structs            | 8     | 1           | Documented in coverage.md          |
| register           | 8     | 2           | Documented in coverage.md          |
| primitives         | 8     | 0           | Documented in coverage.md          |
| initialization     | 8     | 3           | Documented in coverage.md          |
| static-allocation  | 7     | 4           | Documented in coverage.md          |
| bitmap             | 7     | 2           | Documented in coverage.md          |
| ternary            | 6     | 3           | Documented in coverage.md          |
| enum               | 6     | 4           | Documented in coverage.md          |
| sizeof             | 5     | 2           | Documented in coverage.md          |
| references         | 5     | 0           | Documented in coverage.md          |
| nested-structs     | 5     | 0           | Documented in coverage.md          |
| do-while           | 5     | 1           | Documented in coverage.md          |
| const              | 5     | 3           | Documented in coverage.md          |
| comments           | 5     | 2           | Documented in coverage.md          |
| bit-indexing       | 5     | 0           | Documented in coverage.md          |
| atomic             | 5     | 1           | **Includes atomic-volatile-error** |
| array-initializers | 5     | 0           | Documented in coverage.md          |
| preprocessor       | 4     | 2           | Documented in coverage.md          |
| forward-declarations | 4   | 1           | Documented in coverage.md          |
| critical           | 4     | 1           | Documented in coverage.md          |
| callbacks          | 4     | 1           | Documented in coverage.md          |
| assignment         | 4     | 1           | Documented in coverage.md          |
| logical            | 3     | 0           | Documented in coverage.md          |
| isr                | 3     | 0           | Documented in coverage.md          |
| include            | 3     | 0           | Documented in coverage.md          |
| functions          | 3     | 0           | Documented in coverage.md          |
| for-loops          | 3     | 0           | Documented in coverage.md          |
| c-interop          | 3     | 0           | Documented in coverage.md          |
| array-struct-member| 2     | 0           | Documented in coverage.md          |
| platformio-detect  | 1     | 0           | Documented in coverage.md          |
| basics             | 1     | 0           | Documented in coverage.md          |
| **TOTAL**          | **251** | **72**    | **vs coverage.md claim of 225**    |

**Gap Analysis:**
- Coverage.md claims: 225 tests
- Actual test files: 251
- **Gap: 26 files**

**Sources of the 26-file gap:**
1. **Floats directory** (10 files) - completely missing from coverage.md
2. **Recent arithmetic tests** (~6 files): safe-div-all-types, safe-div-basic, safe-div-preserve-on-error, safe-mod-basic, division-const-zero-formats, division-non-zero-const
3. **Scope comprehensive tests** (~5 files): this-all-types, global-all-types, scope-modifier-combos, scope-method-contexts, scope-critical-section
4. **Miscellaneous** (~5 files): Recent additions not yet documented

---

## Next Steps for coverage.md Updates

1. **Section 1.3** (lines 243-278): Update ALL f32/f64 rows from `[ ]` to `[x]`
2. **Section 3** (lines 446-525): ADD float comparison rows for all 6 operators
3. **Section 4** (lines 528-603): ADD float arithmetic rows for all 5 operations
4. **Section 32.2** (lines 1389-1397): Update float literal rows to `[x]`
5. **Section 22** (Type Casting): ADD rows for float/int conversions
6. **Statistics** (lines 1512-1557): Update count to 251, add floats category
7. **Section 30a** (Volatile): ADD implementation note about minimal coverage
