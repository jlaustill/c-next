# Issue #847 — MISRA C:2012 Rule 17.7 / ADR-070

Regression fixtures for discarded non-void return values.

## What this guards

ADR-070 splits a discarded return into two cases, handled in two different
places. These fixtures pin the half that lives in **codegen**; the half that
lives in **analysis** is pinned by `tests/analysis/return-value-discarded`.

| Case | Who wrote the call               | Behaviour                           | Guarded by                                       |
| ---- | -------------------------------- | ----------------------------------- | ------------------------------------------------ |
| 1    | the transpiler (string lowering) | `(void)` cast emitted automatically | `lowered-string-calls.test.cnx` (here)           |
| 2    | the developer                    | compile error **E0708**             | `tests/analysis/return-value-discarded.test.cnx` |

## `lowered-string-calls.test.cnx`

Covers the two `StringUtils` lowering forms that emit a library call:

- `copyWithNull` — a plain `string<N>` assignment
- `copy` — a string array element assignment

Every emitted `strncpy`/`strncat` must carry an explicit `(void)`. The author
never wrote these calls, so the cast is codegen rather than a language change —
which is why this is a snapshot fixture and not a `test-error` one.

## Why the cast lives in one place

`StringUtils` is the sole producer of these calls. `StringDeclHelper` used to
rebuild two of the sequences inline, which would have meant remembering the
cast in three places; it now delegates. If a future change reintroduces a
second producer, this fixture keeps passing while the new path silently emits
an uncast call — so the guard is the single emit site, and this fixture is what
proves that site is correct.

## Not covered here

- `concat` / `substring` lowering onto an **assignment** target is broken
  independently of this issue — see **#1257** (declaration path works, assignment
  path emits non-compiling C). Once that is fixed, those two forms belong in this
  fixture too.
- String assignment to a **struct parameter's** field emits `.` rather than `->`
  — see **#1256**. Also independent, also found while writing this fixture.
