# C Callback Signature Compatibility Design

**Issue:** #882 (continuation) — callback-assign test needs execution
**Date:** 2026-02-21
**Status:** Implemented

## Problem

When a C-Next function is assigned to a C callback typedef (function pointer), the generated signatures don't match:

| Mode | C-Next generates               | C callback expects  | Match? |
| ---- | ------------------------------ | ------------------- | ------ |
| C++  | `void handler(const Point& p)` | `void (*)(Point p)` | No     |
| C    | `void handler(const Point* p)` | `void (*)(Point p)` | No     |

This makes `PointCallback cb = handler;` a compile error in both modes.

## Root Cause

ADR-006 makes all struct parameters pass-by-reference (pointer in C, reference in C++). But C function pointer typedefs from included headers always expect by-value parameters. When assigning a C-Next function to such a typedef, the signatures are incompatible.

## Solution

Detect functions assigned to C function pointer typedefs during analysis and mark their struct parameters for pass-by-value generation.

### Key Insight

Two independent systems control struct param behavior:

1. **Signature** (`ParameterSignatureBuilder`): driven by `isPassByValue`
2. **Body member access** (`MemberSeparatorResolver`): driven by `isStruct` in `TParameterInfo`

In C++ mode, both const-ref and by-value use `.` notation — only the signature changes.
In C mode, by-value uses `.` while by-reference uses `->` — both signature AND body change.

### Changes

1. **New state**: `CodeGenState.callbackCompatibleFunctions: Set<string>`
   - Functions that need C-callback-compatible (by-value) struct parameters

2. **Detection** (analysis phase — `FunctionCallAnalyzer` or new analyzer):
   - Scan variable declarations for patterns like `PointCallback cb <- my_handler`
   - Look up type in `CodeGenState.symbolTable.getCSymbol(typeName)`
   - If it's a typedef (`kind: "type"`) with `(*)` in the type string → C function pointer
   - If initializer is a known function → add to `callbackCompatibleFunctions`

3. **Signature fix** — `CodeGenerator._isPassByValueType()`:
   - If current function is in `callbackCompatibleFunctions` AND param type is struct → true

4. **Body fix** — `FunctionContextManager.processParameter()`:
   - If current function is in `callbackCompatibleFunctions` → set `isStruct: false`
   - This makes C mode use `.` instead of `->` and skips pointer dereference

### Result

| Mode | Signature after | Body after         |
| ---- | --------------- | ------------------ |
| C++  | `Point p`       | `p.x` (unchanged)  |
| C    | `Point p`       | `p.x` (was `p->x`) |

### Test Changes

- `callback-assign.test.cnx`: Remove `test-transpile-only`, remove `test-cpp-only`, add execution validation
- Update `.expected.cpp` with by-value signature
- Add `.expected.c` for C mode
- Make test self-contained (provide `register_callback` implementation or restructure)

## Edge Cases

- Function assigned to both C-Next and C callbacks: unlikely, would need wrapper (future work)
- Multiple struct params: all become by-value (C callbacks always use by-value)
- Detection of `register_callback(handler)`: requires knowing param types — handle if needed

## Files to Change

- `src/transpiler/state/CodeGenState.ts` — new `callbackCompatibleFunctions` set
- `src/transpiler/logic/analysis/FunctionCallAnalyzer.ts` — detection logic
- `src/transpiler/output/codegen/CodeGenerator.ts` — `_isPassByValueType()` check
- `src/transpiler/output/codegen/helpers/FunctionContextManager.ts` — `isStruct` override
- `tests/interop/callback-signature/` — update test files
