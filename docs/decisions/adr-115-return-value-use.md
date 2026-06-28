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

> This ADR is in **Research** status — nothing here is implemented. The owner has fixed the
> design direction (see "Decided Direction"); what remains open is rollout and final
> error-code/edge-case confirmation before it advances to Accepted.

Make it a **compile error (proposed E0708)** to discard the value of a non-void function call
used as a bare expression statement, **unless** the discard is explicit. Concretely:

```cnx
next();             // E0708 — return value of non-void 'next' is discarded
(void) next();      // OK — explicitly discarded
u32 v <- next();    // OK — used
```

### Recommended model: safe-by-default + explicit `(void)` discard, no exceptions

Two sub-decisions, with **no opt-out mechanism** — C-Next is C, and the project principle is
that _exceptions to rules are where bugs come from._

1. **Default — every non-void return must be used or explicitly discarded** (safe-by-default).
   Strongest guarantee, fits C-Next's explicit-flow ethos. There is no opt-in/opt-out; the rule
   holds uniformly for every non-void call whose return type C-Next can resolve.
2. **Explicit discard syntax — `(void) expr;`** — the standard C cast-to-`void`. This is the
   established C idiom for "I am intentionally not using this return value," e.g.
   `(void) printf("not using the return value intentionally!");`. It **parses today**: it is the
   existing ADR-017 cast expression (`'(' type ')' unaryExpression`, with `void` a valid
   `type`), so no new syntax, keyword, or magic identifier is introduced. It is also the _exact
   same token sequence_ the #847 codegen emits for Case 1 — so the author's explicit discard and
   the compiler's auto-discard are one idiom in source and in generated C.

### Considered alternatives

- **Opt-in `must_use` annotation** (Rust's default `#[must_use]`): only annotated functions
  error on discard; everything else is silently discardable. _Rejected as the default stance_ —
  unsafe-by-default contradicts C-Next's philosophy; the dangerous case (an un-annotated
  error-returning function) slips through.
- **A `discardable` opt-out** (Swift's `@discardableResult`: annotate functions whose return is
  "usually ignored" so they may be discarded silently). _Rejected._ The opt-out is itself the
  silent-discard hole the rule exists to close — the moment a function is marked `discardable`,
  every dropped return at every call site stops being checked, which is exactly the class of bug
  (a dropped status/error code) this ADR targets. Exceptions to rules are where bugs come from;
  there is no exception.
- **`_ <- expr;` Rust-style sink, or a `discard`/`ignore` keyword** instead of `(void) expr;`:
  _Rejected._ C-Next is C, not Swift or Rust — the C cast-to-`void` is the idiom C programmers
  already know, it already parses, and it matches the generated output. A new sink identifier or
  keyword would be a gratuitous divergence from C for no gain.

### Standard-library / C-interop returns

Under safe-by-default, `printf(...)` as a statement errors (it returns `int`). Options:

- **(a) Curated `discardable` stdlib set**: treat the printf-family and similar
  "result usually ignored" libc functions as silently discardable via a `DISCARDABLE` set in the
  `StdlibFunctions` metadata module from #847. _Rejected_ — same reason as the `discardable`
  opt-out above: a curated carve-out is a standing exception, and exceptions to rules are where
  bugs come from.
- **(b) Require `(void) printf(...)`** everywhere the return is dropped (chosen). Maximally
  explicit and uniform: the rule has no special cases, and a discarded stdlib return reads
  identically to a discarded C-Next return. The "noise" is the point — every intentional discard
  is visible at its call site.
- **(c) Exempt all unparsed external C** (functions whose return type C-Next cannot see): C-Next
  _does_ know many returns (C-Next funcs + parsed C headers via `CResolver` + the stdlib map), so
  a blanket exemption under-enforces. The enforce-where-resolvable boundary in (b) is not an
  _exception_ to the rule — it is the rule's domain (you cannot check a return type you cannot
  see); see Open Questions for the unresolvable-return case.

Decision: **(b)** — require an explicit `(void)` cast wherever the return type is known,
including the stdlib. No curated exemption list.

## Architecture

The rule lives in the **analysis layer** (`src/transpiler/logic/analysis/`) and is enforced by
the existing analyzer-pass mechanism — a listener that walks the parse tree during
`runAnalyzers.ts` and returns `IAnalyzerError[]`. `ReturnPathAnalyzer` (E0704) is the existing
analyzer of the same shape and concern (a compile-time control-flow check over function bodies).

Components and constraints:

- **Enforcement component:** a new analyzer in the analysis layer, surfaced through the same
  registration and error-reporting path (`IBaseAnalysisError`: `code`/`line`/`column`/`message`/
  `helpText`) as the other analyzers.
- **Inputs:** the analyzer needs callee return types at analysis time. Those come from the
  return-type knowledge already available to analyzers — C-Next functions and scope methods,
  parsed C symbols (via the C resolver), and the stdlib metadata map. A callee whose return is
  `void`, or whose return type is unresolvable, is outside the rule's domain.
- **Single source of truth:** "is this expression statement a discarded non-void call?" is one
  decision, owned by one predicate, shared by the Case 2 enforcement (error) and the Case 1
  codegen (`(void)` cast). The two paths must not re-derive it independently (project "No
  Duplicate Code Paths" rule) — they agree because they consult the same predicate, not by
  coincidence.
- **Discard form:** the explicit discard is the existing `(void)` cast expression (ADR-017); no
  grammar, keyword, or symbol-model addition is required to express it. A cast-to-`void` wrapping
  the call is what suppresses the error.
- **Layer constraint:** `logic/analysis/` must not import from `output/`.

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
- **Discarded (needs `(void)`):** the call is the _entire_ expression statement.
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
examples + test suite must be migrated (wrap each intentional discard in `(void)`) before the
rule turns on.

Sequencing relative to #847: ship Case 1 (compiler-internal casts) first (non-breaking), then
this rule.

## Decided Direction

The owner has set these (they are no longer open):

- **Default stance:** safe-by-default — every resolvable non-void return must be used or
  explicitly discarded. No opt-in (`must_use`) and no opt-out (`discardable`); exceptions to
  rules are where bugs come from.
- **Discard syntax:** the C cast-to-`void`, `(void) expr;` (ADR-017, parses today). No new
  sink identifier or keyword.
- **stdlib handling:** no curated carve-out — `(void)` is required at every dropped stdlib
  return whose type is resolvable, identical to C-Next calls.

## Open Questions

- **Unknown external C:** error or exempt when the return type cannot be resolved? (Recommend
  exempt — you cannot check a return type you cannot see; this is the rule's domain boundary,
  not a carve-out.)
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

C-Next takes the **strictest** stance: safe-by-default like Swift's _default_, but with **no
opt-out** at all (stricter than Swift/Rust/C++), and the discard form is **C's own
`(void)` cast** (as in C++'s `[[nodiscard]]` exemption) rather than a borrowed sink or keyword —
C-Next is C.

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
