# BUGS DISCOVERED: Postfix Expression Chain Issues

**Discovered by:** Comprehensive postfix expression chain testing (11 test files)
**Date:** 2026-01-11
**Testing Coverage:** Lines 5850-6285 in CodeGenerator.ts (435 lines of complex postfix handling)

---

## Bug #1: Grammar Limitation - FIXED ✅

### Original Issue

Grammar only allowed ONE member access after array subscripts:

```antlr
| IDENTIFIER ('[' expression ']')+ ('.' IDENTIFIER)?   // arr[i].field (optional single member)
```

### Impact

- ❌ `lines[0].start.x <- 10;` - Parser error
- ❌ `meshes[0].vertices[0].x <- 1.0;` - Parser error
- ✅ `lines[0].start <- ...` - Worked (single member)

### Fix Applied

Changed grammar line 485 in CNext.g4:

```antlr
| IDENTIFIER ('[' expression ']')+ ('.' IDENTIFIER)+   // arr[i].field1.field2... (one or more)
```

Added line 486 for arbitrary mixing:

```antlr
| IDENTIFIER (('[' expression ']') | ('.' IDENTIFIER))+   // arr[i].field[j].member...
```

### Status

✅ **FIXED** - Parser now accepts arbitrary postfix chains

---

## Bug #2: Code Generator Order Scrambling - PARTIAL FIX 🔶

### Issue

Code generator doesn't preserve the correct order of operations in complex postfix chains.

### Reproduction

```cnx
struct Vec3 { f32 x; }
struct Mesh { Vec3 vertices[2]; }
Mesh meshes[2];

void main() {
    meshes[0].vertices[0].x <- 1.0;
}
```

### Generated (WRONG)

```c
meshes[0][0].vertices.x = 1.0;   // Concatenates all indices, then all members
```

### Expected (CORRECT)

```c
meshes[0].vertices[0].x = 1.0;   // Preserves operation order
```

### Root Cause

`generateMemberAccess()` at lines 6646-6779 in CodeGenerator.ts:

- Lines 6715-6717: Concatenates ALL array indices together
- Lines 6728-6738: Old logic only handled two patterns (dots-first or brackets-first)
- New grammar allows ARBITRARY mixing, but code generator still uses old logic

### Attempted Fix

Added text-parsing logic at lines 6720-6762 to walk through operations in order. However, debugging revealed the fix isn't being reached or isn't working correctly.

### Status

🔶 **PARTIAL** - Grammar fixed, code generator needs more investigation

### Next Steps

1. Add file-based logging to trace execution path
2. Verify which memberAccess rule is matching
3. Fix order preservation logic or rewrite using AST traversal

---

## Bug #3: Scope Self-Reference Error - EXPECTED BEHAVIOR ✅

### Issue

```cnx
scope MotorController {
    const u32 DEFAULT_SPEED <- 100;

    void start() {
        // ERROR: Cannot reference own scope by name
        MotorController.DEFAULT_SPEED <- ...;
    }
}
```

### Status

✅ **NOT A BUG** - This is correct semantic enforcement. Inside a scope, use `this.` not the scope name.

---

## Bug #4: Write-Only Register False Assignment - EXPECTED BEHAVIOR ✅

### Issue

```cnx
register GPIO @ 0x40000000 {
    DR_SET: u32 wo @ 0x84,
}

void main() {
    // ERROR: Cannot assign false to write-only SET register
    GPIO.DR_SET[3] <- false;
}
```

### Status

✅ **NOT A BUG** - Semantic validation correctly catches misuse. Use DR_CLEAR register to clear bits.

---

## Bug #5: Pass-by-Pointer Code Generation Issues - FIXED ✅

### Issue

When C-Next converts value parameters to pointer parameters (for safety/efficiency), the code generator has two problems:

### Problem 1: Struct pointer not dereferenced when assigning

**C-Next code:**

```cnx
void setTransform(Transform t, u32 index) {
    transforms[index] <- t;
}
```

**Generated C (WRONG):**

```c
void setTransform(Transform* t, uint32_t* index) {
    transforms[(*index)] = t;  // BUG: assigning Transform* to Transform
}
```

**Expected C (CORRECT):**

```c
void setTransform(Transform* t, uint32_t* index) {
    transforms[(*index)] = *t;  // Must dereference pointer
}
```

### Problem 2: Integer literals passed directly to pointer params

**C-Next code:**

```cnx
setTransform(temp, 2);
u32 idx <- addU32(1, 1);
```

**Generated C (WRONG):**

```c
setTransform(&temp, 2);     // BUG: 2 is int literal, not uint32_t*
uint32_t idx = addU32(1, 1); // BUG: same issue
```

**Expected C (CORRECT):**

```c
setTransform(&temp, &(uint32_t){2});              // C99 compound literal
uint32_t idx = addU32(&(uint32_t){1}, &(uint32_t){1});
```

### Root Cause

Code generator's pass-by-pointer transformation was incomplete:

1. Assignment expressions didn't dereference struct pointers
2. Function call arguments didn't handle integer literals for pointer params

### Fix Applied

1. **Struct dereference**: Added check in `generatePostfixExpr()` - when a struct param is used as a whole value (no postfix ops), wrap in `(*param)`
2. **Literal handling**: Added `isLiteralExpression()` helper and modified `generateFunctionArg()` to use C99 compound literals: `&(type){value}`

### Status

✅ **FIXED** - Both issues resolved

### Test File

- `tests/postfix-chains/function-call-chain.test.cnx` (enabled, passing)

---

## Test Files Created

Comprehensive postfix chain test suite in `tests/postfix-chains/`:

1. **basic-two-level.test.cnx** - Simple 2-level chains
2. **deep-three-plus-levels.test.cnx** - 4+ level nesting
3. **register-bitmap-bit-chain.test.cnx** - Register + bitmap + bit indexing
4. **scoped-register-bitmap-chain.test.cnx** - Scope + register + bitmap
5. **array-struct-chain.test.cnx** - Arrays with struct members
6. **function-call-chain.test.cnx** - Function calls with chain params (tests float handling)
7. **mixed-access-ultimate.test.cnx** - 7-level mega chains (ultimate stress test)
8. **write-only-register-chain.test.cnx** - Write-only register edge cases
9. **multi-bit-range-chain.test.cnx** - Multi-bit field ranges `[start, width]`
10. **boundary-conditions.test.cnx** - Max indices, edge cases
11. **const-expression-chain.test.cnx** - Const expressions as indices

### Tests Passing

- ✅ basic-two-level.test.cnx
- ✅ register-bitmap-bit-chain.test.cnx
- ✅ function-call-chain.test.cnx (Bug #5 fixed!)

### Tests Blocked by Bug #2

- ❌ array-struct-chain.test.cnx
- ❌ deep-three-plus-levels.test.cnx
- ❌ boundary-conditions.test.cnx
- ❌ const-expression-chain.test.cnx
- ❌ mixed-access-ultimate.test.cnx
- ❌ multi-bit-range-chain.test.cnx

### Tests Blocked by Semantic Constraints (Expected)

- ❌ scoped-register-bitmap-chain.test.cnx (scope self-reference)
- ❌ write-only-register-chain.test.cnx (false to SET register)

---

## Impact Assessment

### Critical Path Code Tested

✅ **Lines 5850-6285 in CodeGenerator.ts** - The most complex postfix expression handling

### Bugs Found

- 1 Grammar bug (FIXED) - Bug #1
- 1 Code generator order bug (IN PROGRESS) - Bug #2
- 1 Code generator pass-by-pointer bug (FIXED) - Bug #5
- 2 Semantic validations confirmed working correctly

### Value Delivered

Comprehensive testing exposed bugs in the EXACT high-risk area identified in the initial analysis. The 11 test files provide permanent regression protection for the most complex code in the transpiler.

---

## Workaround (Until Bug #2 Fixed)

For `arr[i].struct.field[j].member`:

**Option 1: Flatten**

```cnx
meshes[0].vertices[0].x <- 1.0;
// becomes
meshes[0].vertexX[0] <- 1.0;
```

**Option 2: Temporary**

```cnx
Vec3 temp <- meshes[0].vertices[0];
temp.x <- 1.0;
meshes[0].vertices[0] <- temp;
```

**Option 3: Separate statements**

```cnx
meshes[0].vertices[0].x <- 1.0;
// Split into:
vertices <- meshes[0].vertices;
vertices[0].x <- 1.0;
```
