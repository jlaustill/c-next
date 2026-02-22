# Bug #895: Comprehensive Callback Scope Test

Exhaustive reproduction of callback pointer signature bugs across every legal
combination of callback-definition scope × registration-access scope.

**C-Next version tested:** v0.2.5 (includes PR #897 fix)

## Summary

Three distinct bugs found:

| Bug   | Description                                                           | Affects                                |
| ----- | --------------------------------------------------------------------- | -------------------------------------- |
| **A** | Scope callback signatures: opaque types as value, primitives as value | All scope callbacks (public + private) |
| **B** | Opaque type local variables generated as value, not pointer           | All functions (global + scope)         |
| **C** | Header/implementation signature mismatch for scope callbacks          | All public scope callbacks             |

## Callback typedef (from widget.h)

```c
typedef void (*flush_cb_t)(widget_t *w, const rect_t *area, uint8_t *buf);
```

Expected C signature for any callback:

```c
void cb(widget_t* w, const rect_t* area, uint8_t* buf)
```

---

## Bug A: Scope callback signatures wrong

Global functions transpile correctly. ALL scope functions are broken.

| Callback         | Kind          | File      | Generated Signature                               | Status   |
| ---------------- | ------------- | --------- | ------------------------------------------------- | -------- |
| `a_global_cb`    | Global        | defs.c:23 | `(widget_t* w, const rect_t* area, uint8_t* buf)` | PASS     |
| `b_global_cb`    | Global        | test.c:24 | `(widget_t* w, const rect_t* area, uint8_t* buf)` | PASS     |
| `ScopeAP_cb`     | Scope public  | defs.c:30 | `(widget_t w, const rect_t* area, uint8_t buf)`   | **FAIL** |
| `ScopeBP_cb`     | Scope public  | test.c:31 | `(widget_t w, const rect_t* area, uint8_t buf)`   | **FAIL** |
| `ScopeAPSelf_cb` | Scope public  | defs.c:90 | `(widget_t w, const rect_t* area, uint8_t buf)`   | **FAIL** |
| `ScopeBPSelf_cb` | Scope public  | test.c:97 | `(widget_t w, const rect_t* area, uint8_t buf)`   | **FAIL** |
| `ScopeAV_cb`     | Scope private | defs.c:37 | `(widget_t w, const rect_t* area, uint8_t buf)`   | **FAIL** |
| `ScopeBV_cb`     | Scope private | test.c:38 | `(widget_t w, const rect_t* area, uint8_t buf)`   | **FAIL** |

**Root cause:** PR #897's `FunctionCallAnalyzer` only matches bare function names
at registration call sites. It does not handle:

- `this.cb` (scope self-reference)
- `global.ScopeName.cb` (cross-scope reference)

So the callback-aware signature fix never fires for scope-level functions.

**Two specific sub-issues in each failing signature:**

1. `widget_t w` → should be `widget_t* w` (opaque/forward-declared struct)
2. `uint8_t buf` → should be `uint8_t* buf` (matches `uint8_t *buf` in typedef)

Note: `const rect_t* area` is correct because `rect_t` is a concrete struct
(not forward-declared), and C-Next's pass-by-reference already generates a pointer.

---

## Bug B: Opaque type local variables as value

Every function that calls `widget_create()` generates:

```c
widget_t w = widget_create();
```

Should be:

```c
widget_t* w = widget_create();
```

`widget_t` is forward-declared (`typedef struct widget_t widget_t`), so it's an
incomplete type. You cannot declare a local variable of an incomplete type.

This bug affects ALL 22 functions with local `widget_t` variables — both global
and scope, in both files. It is independent of the callback signature bug.

---

## Bug C: Header/implementation signature mismatch

The generated headers produce DIFFERENT signatures than the implementations:

| Function         | Header (`.h`)                                          | Implementation (`.c`)                           | Match?                               |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------ |
| `ScopeAP_cb`     | `(widget_t* w, const rect_t* area, uint8_t buf)`       | `(widget_t w, const rect_t* area, uint8_t buf)` | **NO** — `widget_t*` vs `widget_t`   |
| `ScopeAPSelf_cb` | `(widget_t* w, const rect_t* area, uint8_t buf)`       | `(widget_t w, const rect_t* area, uint8_t buf)` | **NO**                               |
| `ScopeBP_cb`     | `(const widget_t* w, const rect_t* area, uint8_t buf)` | `(widget_t w, const rect_t* area, uint8_t buf)` | **NO** — also gains spurious `const` |
| `ScopeBPSelf_cb` | `(const widget_t* w, const rect_t* area, uint8_t buf)` | `(widget_t w, const rect_t* area, uint8_t buf)` | **NO**                               |

Additionally, the cross-file headers (`test.h`) add a spurious `const` qualifier
on `widget_t*` that is absent from the same-file headers (`defs.h`). The C-Next
source has no `const` on the `widget_t` parameter.

Note: even the headers are wrong — `uint8_t buf` should be `uint8_t* buf` in
both header and implementation.

---

## Full Registration Matrix (26 test cases)

Each row represents one registration call path. "Definition OK" indicates whether
the callback definition has the correct signature (Bug A). "Local OK" indicates
whether the `widget_t` local at the registration site is correct (Bug B).

### File A callbacks registered from File A (same-file)

| #   | Callback             | Registered From                     | Definition OK | Local OK |
| --- | -------------------- | ----------------------------------- | :-----------: | :------: |
| 1   | A_G (global)         | same-file global fn                 |     PASS      | **FAIL** |
| 2   | A_G (global)         | same-file scope public method       |     PASS      | **FAIL** |
| 3   | A_G (global)         | same-file scope private method      |     PASS      | **FAIL** |
| 4   | A_SP (scope public)  | same-file global fn                 |   **FAIL**    | **FAIL** |
| 5   | A_SP (scope public)  | same-file same-scope public method  |   **FAIL**    | **FAIL** |
| 6   | A_SP (scope public)  | same-file same-scope private method |   **FAIL**    | **FAIL** |
| 7   | A_SP (scope public)  | same-file diff-scope public method  |   **FAIL**    | **FAIL** |
| 8   | A_SP (scope public)  | same-file diff-scope private method |   **FAIL**    | **FAIL** |
| 9   | A_SV (scope private) | same-scope public method            |   **FAIL**    | **FAIL** |
| 10  | A_SV (scope private) | same-scope private method           |   **FAIL**    | **FAIL** |

### File B callbacks registered from File B (same-file)

| #   | Callback             | Registered From                     | Definition OK | Local OK |
| --- | -------------------- | ----------------------------------- | :-----------: | :------: |
| 11  | B_G (global)         | same-file global fn                 |     PASS      | **FAIL** |
| 12  | B_G (global)         | same-file scope public method       |     PASS      | **FAIL** |
| 13  | B_G (global)         | same-file scope private method      |     PASS      | **FAIL** |
| 14  | B_SP (scope public)  | same-file global fn                 |   **FAIL**    | **FAIL** |
| 15  | B_SP (scope public)  | same-file same-scope public method  |   **FAIL**    | **FAIL** |
| 16  | B_SP (scope public)  | same-file same-scope private method |   **FAIL**    | **FAIL** |
| 17  | B_SP (scope public)  | same-file diff-scope public method  |   **FAIL**    | **FAIL** |
| 18  | B_SP (scope public)  | same-file diff-scope private method |   **FAIL**    | **FAIL** |
| 19  | B_SV (scope private) | same-scope public method            |   **FAIL**    | **FAIL** |
| 20  | B_SV (scope private) | same-scope private method           |   **FAIL**    | **FAIL** |

### File A callbacks registered from File B (cross-file)

| #   | Callback            | Registered From                | Definition OK | Local OK |
| --- | ------------------- | ------------------------------ | :-----------: | :------: |
| 21  | A_G (global)        | diff-file global fn            |     PASS      | **FAIL** |
| 22  | A_G (global)        | diff-file scope public method  |     PASS      | **FAIL** |
| 23  | A_G (global)        | diff-file scope private method |     PASS      | **FAIL** |
| 24  | A_SP (scope public) | diff-file global fn            |   **FAIL**    | **FAIL** |
| 25  | A_SP (scope public) | diff-file scope public method  |   **FAIL**    | **FAIL** |
| 26  | A_SP (scope public) | diff-file scope private method |   **FAIL**    | **FAIL** |

### Summary

- **Definition OK:** 8/26 pass (only when callback is a global function)
- **Local OK:** 0/26 pass (opaque type local variables broken everywhere)
- **Fully correct (both):** 0/26

---

## What PR #897 fixed vs what remains

| Scenario                                        | PR #897 Fixed? | Evidence                                         |
| ----------------------------------------------- | :------------: | ------------------------------------------------ |
| Global callback, same-file registration         |      YES       | `a_global_cb` / `b_global_cb` signatures correct |
| Global callback, cross-file registration        |      YES       | Same correct definitions used from other file    |
| Scope public callback, any registration         |     **NO**     | `ScopeAP_cb`, `ScopeBP_cb` etc. all wrong        |
| Scope private callback, same-scope registration |     **NO**     | `ScopeAV_cb`, `ScopeBV_cb` all wrong             |
| Opaque type local variables                     |     **NO**     | `widget_t w = widget_create()` everywhere        |
| Header/impl signature consistency               |     **NO**     | Headers disagree with implementations            |

---

## Files

- `widget.h` — C header with opaque type + callback typedef
- `defs.cnx` — File A: 3 callback definitions + 10 same-file registration paths
- `test.cnx` — File B: 3 callback definitions + 10 same-file + 6 cross-file registration paths
- `defs.c` / `defs.h` — Generated output from defs.cnx
- `test.c` / `test.h` — Generated output from test.cnx

## Reproducing

```bash
cnext test.cnx
# Inspect defs.c, test.c, defs.h, test.h
```
