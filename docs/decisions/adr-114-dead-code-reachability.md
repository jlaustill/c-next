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
  owned by **one** primitive (the `statementDefinitelyReturns` / divergence logic that ADR-113
  introduces into `ReturnPathAnalyzer`). This analyzer _consumes_ that primitive; it does not
  re-implement it. If sharing requires it, the divergence helpers are extracted into a shared
  `logic/analysis/` control-flow module that both `ReturnPathAnalyzer` and `ReachabilityAnalyzer`
  import. This is mandatory under the project's "No Duplicate Code Paths" rule — two passes that
  each decide "what diverges" independently would be a latent divergence bug.
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

## Open Questions

- **Function calls that never return.** Without a `never`/bottom type (see ADR-113,
  Alternative 1), a call like a future `panic()` cannot be treated as divergent, so code after
  it would be wrongly considered reachable. Scope this ADR to _structural_ divergence
  (`return` / `forever` / exhaustive `if`/`switch`) for v1, and revisit if a bottom type lands.
- **Conditional compilation interaction.** Code removed by preprocessor flags is a separate
  mechanism (configuration variance) from control-flow unreachability; confirm the analyzer
  runs on the post-preprocessor tree so flagged-out code is not analyzed.
- **Rollout.** Land behind a flag first, or straight to an error once the examples are clean?
- **Error code:** confirm **E0706** (next free after E0704; E0705 is reserved by ADR-113).
- **Back-reference ADR-112.** When this ADR is accepted/implemented, update ADR-112's
  _Related ADRs_ to include ADR-114 — this pass reuses (the dual of) ADR-112's `definitelyReturns`
  machinery. (Documentation counterpart, not a code change.)

## References

- ADR-112 (All-Paths-Return — provides the dual `definitelyReturns` machinery)
- ADR-113 (Forever Loops — provides the divergence primitive this pass consumes)
- ADR-110 (DO-178C Compliance — frames dead-code detection as a certification requirement)
- Issue #849 (MISRA C:2012 Rule 2.2 — No dead code)
- `docs/misra-compliance.md` (Rules 2.1 and 2.2, both "Not Enforced")
