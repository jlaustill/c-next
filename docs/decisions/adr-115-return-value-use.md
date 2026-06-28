# ADR-115: Mandatory Use of Non-Void Return Values

**Status:** Research
**Date:** 2026-06-27
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-051 (Safe Division), ADR-110 (DO-178C Compliance), ADR-112 (All-Paths-Return), ADR-113 (Forever Loops), ADR-114 (Dead-Code / Reachability)
**Related Issues:** #1080 (this ADR), #847 (MISRA Rule 17.7 `(void)` casts in generated C — the codegen counterpart), #1081 (Rule 21.15, unmasked by the slice-`memcpy` cast)

## Context

C-Next today **silently allows a non-void function's return value to be discarded.**
This transpiles without complaint:

```cnx
u32 next() { value <- value + 1; return value; }

i32 main() {
    next();          // return value silently dropped
    return 0;
}
```

Ignoring a return value is a classic embedded foot-gun: a dropped error/status code, a
discarded `safe_div` outcome, an unchecked parse result. C-Next's whole premise is "a safer
C" with **explicit data flow** (`<-` for assignment, no implicit conversions, no `switch`
fallthrough, all-paths-return). "You must acknowledge what a function hands back" fits that
philosophy directly — and is exactly the class of bug ADR-110 (DO-178C) and MISRA care about.

### Why the #847 codegen fix is not enough

**#847** made the _generated C_ MISRA C:2012 **Rule 17.7** compliant by emitting a `(void)`
cast on discarded non-void calls. That silences the downstream tool, but does nothing for the
C-Next author — the language still lets you silently drop a value you may have wanted. A safer
language should reject the mistake at its own source level, not paper over it in the output.

Work on #847 surfaced that "discarded non-void call" splits into **two cases that must be
handled differently**, and PR #1082 was closed because it conflated them:

| Case                              | Example                                            | Who wrote the call | Correct behavior                                                              |
| --------------------------------- | -------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| **1. Compiler-internal lowering** | `s <- "x"` → `strncpy`; `buf[0,4] <- v` → `memcpy` | the transpiler     | auto-`(void)` cast — **not** a language change; the author never wrote a call |
| **2. User-written discard**       | `next();`, `printf(...)`, `parse();`               | the developer      | **compile error** unless explicitly discarded                                 |

This ADR governs **Case 2**. Case 1 is uncontroversial codegen (the compiler casting its own
emitted calls) and can ship independently; it is in scope here only so the two are designed
together and the relationship is explicit.

## Decision (Proposed — Research)

> This ADR is in **Research** status. The direction below reflects the current design
> conversation; nothing here is approved or implemented.

Make it a **compile error (proposed E0708)** to discard the value of a non-void function call
used as a bare expression statement, **unless** the discard is explicit. Concretely:

```cnx
next();             // E0708 — return value of non-void 'next' is discarded
_ <- next();        // OK — explicitly discarded
u32 v <- next();    // OK — used
```

### Recommended model: safe-by-default + explicit discard + `discardable` opt-out

This mirrors **Swift**, which reversed its original "ignore by default" behavior in Swift 3
because silent discards caused real logic bugs, and now requires return-value use with an
`@discardableResult` opt-out. Three sub-decisions:

1. **Default — every non-void return must be used or explicitly discarded** (safe-by-default).
   Strongest guarantee, fits C-Next's explicit-flow ethos.
2. **Explicit discard syntax — `_ <- expr;`** (recommended). Reuses the `<-` "assignment is
   flow" operator with a `_` sink: _"route this return into the void."_ It parses **today**
   (`_` is already a valid `IDENTIFIER`; see Architecture), needs no new keyword, and matches
   Rust's `let _ = expr;` / `_ = expr;` idiom. `_` becomes a magic discard target: never
   declared, accepts any type, assignable repeatedly, generates no storage.
3. **`discardable` opt-out** for the minority of functions whose return is genuinely optional
   (fluent/builder APIs, logging). A `discardable`-annotated function may be discarded with no
   error and no `_ <-`. This is the escape hatch that keeps idiomatic code ergonomic.

### Considered alternatives

- **Opt-in `must_use` annotation** (Rust's default `#[must_use]`): only annotated functions
  error on discard; everything else is silently discardable. _Rejected as the default stance_ —
  unsafe-by-default contradicts C-Next's philosophy; the dangerous case (an un-annotated
  error-returning function) slips through.
- **Always-error, no opt-out** (Rust's `unused_results`, allow-by-default for noise reasons):
  maximal safety but forces `_ <- printf(...)` everywhere. _Rejected_ as too noisy without the
  `discardable` escape hatch.
- **`discard expr;` / `ignore expr;` keyword** instead of `_ <-`: clear, but adds a keyword and
  a statement form for something `_ <-` already expresses. _Kept as a fallback_ if `_`-as-sink
  proves objectionable.

### Standard-library / C-interop returns (the hard question)

Under safe-by-default, `printf(...)` as a statement would error (it returns `int`), which would
break a great deal of ordinary code. Options:

- **(a) Curated `discardable` stdlib set** (recommended): treat the printf-family and similar
  "result usually ignored" libc functions as `discardable`. This extends the `StdlibFunctions`
  metadata module created in the #847 work (which already centralizes the stdlib header map and
  void-ness) with a `DISCARDABLE` set — single source of truth, no parallel list.
- **(b) Require `_ <- printf(...)`** everywhere — maximally explicit, maximally noisy.
- **(c) Exempt all unparsed external C** (functions whose return type C-Next cannot see) — but
  C-Next _does_ know many returns (C-Next funcs + parsed C headers via `CResolver` + the stdlib
  map), so a blanket exemption under-enforces.

Recommendation: **(a)**. Enforce where we know the return type; mark the handful of
ignore-by-convention stdlib functions `discardable`.

## Architecture (proposed)

- **New analyzer `ReturnValueUseAnalyzer`** in `src/transpiler/logic/analysis/`, registered in
  `runAnalyzers.ts` like the others (listener + `analyze(tree)` returning `IAnalyzerError[]`,
  error object per `IBaseAnalysisError` with `code`/`line`/`column`/`message`/`helpText`). This
  follows the **ReturnPathAnalyzer (E0704)** precedent almost exactly — same pass, adjacent
  concern.
- **Detection:** for each `expressionStatement`, determine whether it is a single bare call
  whose result is discarded (reuse `ExpressionUnwrapper.getPostfixExpression` +
  `postfixOp` call classification, and `ExpressionUtils.hasFunctionCall`), and resolve the
  callee's return type. Skip the statement when wrapped by the explicit `_ <-` discard target.
- **Return-type knowledge at analysis time:** `CodeGenState.getFunctionReturnType` (C-Next
  funcs + scope methods), parsed C symbols via the C resolver, and the `StdlibFunctions` map.
  A callee whose return is `void` (or unknown/unresolvable external) does not error.
- **Single source of truth for "is this a discarded non-void call?"** The detection predicate
  is owned by **one** helper shared by the analyzer (Case 2, error) and the #847 codegen path
  (Case 1, cast) — the two must never re-derive the decision independently (project "No
  Duplicate Code Paths" rule). The branch `fix/847-misra-17.7-void-cast` (closed PR #1082)
  already prototypes this predicate as `ReturnValueCast.isBareCallStatement` + the
  `CodeGenState.lastCallTarget` plumbing; the same predicate drives both actions.
- **`_` discard target:** add `_` as a recognized discard sink in `assignmentTarget` handling
  (grammar already accepts it as an identifier; the change is semantic — treat assignment to
  `_` as a typed discard rather than a variable write).
- **`discardable` annotation:** grammar + symbol-model addition on function declarations;
  stored on the function symbol and consulted by the analyzer.
- Layer constraint respected: `logic/analysis/` does not import from `output/`.

### Proposed error codes (not yet allocated)

| Code  | Meaning                                     |
| ----- | ------------------------------------------- |
| E0708 | Return value of non-void function discarded |

(E0708 is the next free Control-Flow code: E0705/E0707 are used by ADR-113, E0706 is reserved
by ADR-114.)

## What counts as "used"

To be settled in the ADR, proposed for v1:

- **Used:** bound in a declaration/assignment, passed as a call argument, returned, tested in a
  condition/`switch`, or an operand of any larger expression.
- **Discarded (needs `_ <-`):** the call is the _entire_ expression statement.
- A member/element access on the result (`foo().field;`, `foo()[0];`) is **not** a bare call —
  out of scope for v1 (it is an unusual statement form; revisit if it appears in practice).

## Relationship to #847 and #1081

- **#847 (Case 1):** the compiler-internal `(void)` casts for `string`/slice lowering are the
  correct, non-breaking half. They can ship independently of this ADR. Full enforcement of
  MISRA Rule 17.7 (i.e. removing it from the baseline) is **blocked on this ADR**, because user
  discards must become errors before the rule holds without per-call casts.
- **#1081 (Rule 21.15):** adding the slice-`memcpy` `(void)` cast unmasks a pre-existing 21.15
  (incompatible `uint8_t*` vs `uintN_t*`). cppcheck reports one rule per line, so 21.15 is
  latent on `main` until the cast lands. Implementing Case 1 here will surface it.
- **safe_div / safe_mod (ADR-051):** at the C-Next source level these are out-parameter
  builtins with no bound return, so the must-use rule does **not** apply to them. (Their
  _generated_ helper returns `bool`; that is a Case-1 codegen detail, not a Case-2 author
  concern.)

## Breaking-Change Note

Turning user discards into an error is a **breaking change**: every site that currently drops a
non-void return starts failing. Scoping #847 surfaced **100+** such call sites across the test
suite (printf-family, scope getters used as statements, etc.). Rollout strategy is an open
question (below). A repo-wide `npm run unit` — which transpiles every example via
`scripts/__tests__/examples-transpile.test.ts` — must gate the rule's introduction, and the
examples + test suite must be migrated (`_ <-` or `discardable`) before the rule turns on.

Sequencing relative to #847: ship Case 1 (compiler-internal casts) first (non-breaking), then
this rule.

## Open Questions

- **Default stance:** confirm safe-by-default + `discardable` (recommended) vs opt-in
  `must_use`.
- **Discard syntax:** confirm `_ <- expr;` (recommended) vs a `discard`/`ignore` keyword. Does
  `_` as a magic sink interact badly with any real use of `_` as an identifier? (It is legal
  today; do any tests/examples use it as a normal variable?)
- **stdlib handling:** confirm the curated `discardable` set approach, and enumerate which libc
  functions are `discardable` (printf family, `puts`, `putchar`, …).
- **Unknown external C:** error or exempt when the return type cannot be resolved? (Recommend
  exempt — don't flag what we can't prove.)
- **`discardable` surface:** can the developer annotate their _own_ functions `discardable`?
  (Recommend yes — symmetric with the stdlib treatment.)
- **Rollout:** behind a flag first, or straight to an error once the suite/examples are
  migrated?
- **Error code:** confirm **E0708**.

## Prior Art

| Language  | Mechanism                                              | Default                                           | Explicit discard        |
| --------- | ------------------------------------------------------ | ------------------------------------------------- | ----------------------- |
| **Swift** | `@discardableResult`                                   | **must-use** (since Swift 3, reversed for safety) | assign to `_`           |
| **Rust**  | `#[must_use]` (warn) / `unused_results` (allow)        | opt-in must-use                                   | `let _ = e;` / `_ = e;` |
| **C++**   | `[[nodiscard]]` / `[[nodiscard("reason")]]` (C++17/20) | opt-in; cast-to-`void` exempt                     | `(void)e;`              |
| **Go**    | `errcheck` / `go vet` (lint, not language)             | tool-enforced                                     | `_ = e`                 |

C-Next's recommended model is closest to **Swift**: safe-by-default with a `discardable`
opt-out, plus an explicit `_ <-` discard borrowed from Rust's `_` sink.

## References

- Issue #1080 (this ADR's tracking issue, with the original design discussion)
- Issue #847 (MISRA Rule 17.7 `(void)` casts — Case 1 codegen counterpart)
- Issue #1081 (MISRA Rule 21.15 — unmasked by the slice-`memcpy` cast)
- ADR-112 / ADR-114 (`ReturnPathAnalyzer` + analyzer-pass precedent: E0704)
- ADR-113 (Forever Loops — most recent compile-time control-flow rejection precedent)
- ADR-110 (DO-178C Compliance — frames unchecked returns as a certification concern)
- `docs/error-codes.md` (E07xx Control-Flow range; E0708 next free)
- MISRA C:2012 Rule 17.7 (the output-level rule #847 satisfies)
- Rust `unused_must_use` / `unused_results` lints; RFC 1940 (must-use functions)
- C++ `[[nodiscard]]` (cppreference); Swift `@discardableResult`
