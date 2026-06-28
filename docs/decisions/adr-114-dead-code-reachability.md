# ADR-114: Dead-Code / Reachability Analysis

**Status:** Research
**Date:** 2026-06-26
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-112 (All-Paths-Return), ADR-110 (DO-178C Compliance), ADR-113 (Forever Loops)
**Related Issues:** #849 (MISRA 2.1/2.2 — No unreachable / dead code; the active issue) — formerly part of the now-closed #839 MISRA-breakdown parent

## Context

C-Next performs **no control-flow-reachability analysis today** (stated outright in ADR-112:
"There is no control-flow-reachability analysis in the transpiler today."). The transpiler
silently accepts — and emits — unreachable code:

```cnx
u8 f() {
    return 1;
    side();        // unreachable
}
```

transpiles (verified) to:

```c
uint8_t Main_f(void) {
    return 1;
    Main_side();   // dead code, passed straight through
}
```

This violates two MISRA C:2012 rules, both currently marked **Not Enforced** in
`docs/misra-compliance.md`:

- **Rule 2.1** — _A project shall not contain unreachable code._
- **Rule 2.2 (Mandatory)** — _There shall be no dead code._ (Tracked in **Issue #849**.)

It also blocks the **Dead Code Detection** feature that **ADR-110 (DO-178C, Research)** lists as
a feasible addition — DO-178C prohibits deactivated code at _all_ design assurance levels.

A "safer C" emitting dead code that downstream MISRA tooling then flags is backwards: the
language should reject it at the source.

### The dual already exists

The machinery is mostly present. `ReturnPathAnalyzer` (ADR-112) already computes the **dual**
of reachability: `blockDefinitelyReturns` is true iff any contained statement
`definitelyReturns`, with the explicit note that _"statements after an unconditional return are
unreachable."_ Reachability is the inverse question over the same structural walk:

> A statement is **unreachable** iff some earlier statement in its block is a **divergent
> statement** (an unconditional `return`, a fully-returning `if`/`else` or `switch`, or — once
> ADR-113 lands — a `forever` loop).

So a reachability pass can reuse ~90% of `ReturnPathAnalyzer`'s logic rather than re-deriving it.

## Decision (Proposed — Research)

> This ADR is in **Research** status. The direction below reflects the current design
> conversation; nothing here is approved or implemented.

Add a compile-time **reachability analysis** that rejects any statement which cannot be reached
on any control-flow path from the function entry (proposed **E0706 — unreachable code**).

### Coverage

- code after an unconditional `return`;
- code after a `forever` loop (ADR-113);
- code after an `if`/`else` where both branches diverge;
- code after a `switch` with a `default` where every case diverges.

### Architecture (proposed)

- New analyzer `ReachabilityAnalyzer` in `src/transpiler/logic/analysis/`, registered in
  `runAnalyzers.ts` like the existing analyzers (listener + `analyze(tree)` returning
  `IAnalyzerError[]`).
- **Single source of truth for divergence.** The "is this statement divergent?" decision is
  owned by **one** primitive. ADR-113 landed `statementDefinitelyReturns` in `ReturnPathAnalyzer`,
  but research (see _Research Findings_ below) shows it is **not** directly reusable: it answers
  _"does this path return a **value**?"_ and deliberately reports `false` for a bare `return;`.
  Reachability needs _"does control fall through?"_, for which a bare `return;` **is** divergent.
  The two predicates coincide everywhere except bare `return;`. The required refactor is to
  extract a shared `statementDiverges(stmt)` base into a `logic/analysis/` control-flow module
  and redefine `statementDefinitelyReturns` on top of it (`diverges && terminal-returns-a-value`).
  `ReachabilityAnalyzer` consumes `statementDiverges` directly; it does not re-implement it. This
  is mandatory under the project's "No Duplicate Code Paths" rule — two passes that each decide
  "what diverges" independently would be a latent divergence bug.
- Layer constraint respected: `logic/analysis/` does not import from `output/`.

### Proposed error codes (not yet allocated)

| Code  | Meaning          |
| ----- | ---------------- |
| E0706 | Unreachable code |

## Relationship to ADR-113

`forever` (ADR-113) and this analysis are **independent** — neither strictly requires the other:

- A reachability pass can already analyze a constant-true loop (`while (1 = 1)`) without the
  `forever` keyword.
- `forever`'s own "no code after the loop" rule needs only the **minimal** divergence check, not
  this full pass.

But they **share the divergence primitive**, and the agreed sequencing is:

1. **ADR-113 first** — introduces the divergence primitive and ships `forever`. Small,
   **non-breaking** (only accepts more programs).
2. **ADR-114 second (this ADR)** — generalizes consumption of that primitive into the full
   reachability pass. **Breaking.**

## Breaking-Change Note

Turning unreachable code into an error is a **breaking change**: any existing code with a dead
trailing statement starts failing. The known instance is the dead `return 0;` in
`examples/nucleo-f446re/blink.cnx` — which **ADR-113 already removes** by converting that
function to `void main()` with a `forever` loop. Sequencing ADR-113 before ADR-114 means the one
known offender is gone before the rule that would flag it turns on. A repo-wide `npm run unit`
(which transpiles every example via `scripts/__tests__/examples-transpile.test.ts`) should gate
the rule's introduction.

## Research Findings (2026-06-28, #849)

Code-verified investigation of the current `main` (post ADR-113 implementation). Status stays
**Research** — nothing below is approved or implemented.

1. **Blocker cleared — ADR-114 is now unblocked.** The sequencing blocker #1074 (ADR-113
   `forever` core) is **closed** (2026-06-27); `forever` is implemented (commit `80dc4123`,
   `feat: implement forever infinite-loop statement`). The dead `return 0;` offender in
   `examples/nucleo-f446re/blink.cnx` is gone — that function now ends `void main() { setup();
forever { loop(); } }`, with no statement after the `forever`. `scripts/__tests__/examples-transpile.test.ts`
   exists and transpiles every example under `npm run unit`, so it can gate the rule's rollout.

2. **The divergence primitive landed, but is NOT verbatim-reusable (key finding).**
   `statementDefinitelyReturns()` in `src/transpiler/logic/analysis/ReturnPathAnalyzer.ts` already
   special-cases `forever` (lines 48–58) with an explicit _"This is the shared 'divergence'
   primitive ADR-114 (#849) reuses"_ comment. **However**, the predicate answers _"does this path
   return a value?"_ and returns `false` for a bare `return;` (lines 28–29: `returnStmt.expression() !== null`).
   For reachability, a bare `return;` **is** divergent — `return; side();` leaves `side()`
   unreachable even in a `void` function. The predicates therefore diverge at exactly one leaf.
   Reusing `statementDefinitelyReturns` verbatim would **miss unreachable code after a bare
   `return;`**. Resolution: extract `statementDiverges(stmt)` (control cannot fall through:
   any `return`, `forever`, exhaustive `if`/`else`, `switch` with `default` where all cases
   diverge) as the shared base; express `statementDefinitelyReturns = statementDiverges && terminalReturnsValue`.
   This keeps a single decision site and satisfies "No Duplicate Code Paths."

3. **Analyzer wiring confirmed.** `ReachabilityAnalyzer` follows the `ReturnPathAnalyzer` pattern:
   a `CNextListener` + `analyze(tree): IAnalyzerError[]`, registered in
   `src/transpiler/logic/analysis/runAnalyzers.ts` (currently 11 steps; ReturnPath is step 10,
   short-circuited via `collectErrors`). Layer constraint holds — `logic/analysis/` imports no
   `output/`. Note: the related E0707 (disguised loops, #1075) was implemented in **`output/codegen`**
   (`TypeValidator.ts` / `ControlFlowGenerator.ts`), a different layer. ADR-114 should follow the
   **`ReturnPathAnalyzer` (logic/analysis)** pattern, not E0707's — reachability is structural CFG
   analysis on the parse tree, not codegen.

4. **Error code E0706 is free and already reserved** for this ADR (`docs/error-codes.md`:
   _"E0706 reserved for ADR-114 unreachable code"_). E0705 = `forever` in non-void; E0707 =
   disguised loop. Open question on the code number is **resolved: use E0706.**

5. **Post-preprocessor concern is mild.** Analyzers run on the directly-parsed `.cnx` tree
   (`CNextSourceParser.parse(source)` in `Transpiler._transpileFile`); C-Next conditional
   compilation is a header/include mechanism, not intra-body statement deletion. Structural
   reachability over the parsed function body is therefore well-defined. _(Still confirm no
   source-level construct removes statements from a function body before accepting the ADR.)_

## Open Questions

- **Function calls that never return.** Without a `never`/bottom type (see ADR-113,
  Alternative 1), a call like a future `panic()` cannot be treated as divergent, so code after
  it would be wrongly considered reachable. Scope this ADR to _structural_ divergence
  (`return` / `forever` / exhaustive `if`/`switch`) for v1, and revisit if a bottom type lands.
- **Conditional compilation interaction.** Code removed by preprocessor flags is a separate
  mechanism (configuration variance) from control-flow unreachability. **Partially resolved
  (2026-06-28):** the analyzer runs on the directly-parsed `.cnx` tree and C-Next conditional
  compilation is a header/include mechanism, not intra-body statement deletion (Research Finding
  5). Remaining: confirm no source-level construct deletes function-body statements.
- **Rollout.** Land behind a flag first, or straight to an error once the examples are clean?
- ~~**Error code:** confirm **E0706**.~~ **Resolved (2026-06-28):** E0706 is free and already
  reserved for this ADR in `docs/error-codes.md`. See Research Finding 4.
- **Back-reference ADR-112.** When this ADR is accepted/implemented, update ADR-112's
  _Related ADRs_ to include ADR-114 — this pass reuses (the dual of) ADR-112's `definitelyReturns`
  machinery. (Documentation counterpart, not a code change.)

## References

- ADR-112 (All-Paths-Return — provides the dual `definitelyReturns` machinery)
- ADR-113 (Forever Loops — provides the divergence primitive this pass consumes)
- ADR-110 (DO-178C Compliance — frames dead-code detection as a certification requirement)
- Issue #849 (MISRA C:2012 Rule 2.2 — No dead code)
- `docs/misra-compliance.md` (Rules 2.1 and 2.2, both "Not Enforced")
