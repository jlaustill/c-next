# ADR-069: Dead-Code / Reachability Analysis

> **Formerly ADR-114.** Renumbered 2026-08-23 into the `0xx` band — this is
> v1-gating work. See [`README.md`](README.md) for the numbering rule and the full
> mapping table.

**Status:** Research
**Date:** 2026-06-26 (design questions resolved 2026-08-23; awaiting final review)
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-067 (All-Paths-Return), ADR-066 (DO-178C Compliance), ADR-068 (Forever Loops), ADR-070 (Return-Value Use), ADR-058 (Explicit Length Properties)
**Related Issues:** #849 (MISRA 2.1/2.2 — No unreachable / dead code; the active issue) — formerly part of the now-closed #839 MISRA-breakdown parent; #1107 (unused variables — the liveness half of this ADR, added below)

## Context

C-Next performs **no control-flow-reachability analysis today** (stated outright in ADR-067:
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

It also blocks the **Dead Code Detection** feature that **ADR-066 (DO-178C, Research)** lists as
a feasible addition — DO-178C prohibits deactivated code at _all_ design assurance levels.

A "safer C" emitting dead code that downstream MISRA tooling then flags is backwards: the
language should reject it at the source.

### The dual already exists

The reasoning is mostly present. ADR-067's all-paths-return rule already computes the **dual**
of reachability: `blockDefinitelyReturns` is true if and only if any contained statement
`definitelyReturns`, with the explicit note that _"statements after an unconditional return are
unreachable."_ Reachability is the inverse question over the same structural walk:

> A statement is **unreachable** if and only if some earlier statement in its block is a **divergent
> statement** (an unconditional `return`, a fully-returning `if`/`else` or `switch`, or — once
> ADR-068 lands — a `forever` loop).

So reachability is that same analysis read the other way, not a second one — which matters
beyond convenience: two analyses that each decide what a statement does will eventually
disagree, and the program they disagree about is the one that matters.

## Decision (Proposed — Research)

> This ADR is in **Research** status. Every design question it raised is now resolved (see
> _Resolved Questions_), but the ADR itself is **not approved and not implemented** — it is
> ready for final review.

Add compile-time **dead-code analysis** covering the two structural flavors of dead code that
MISRA C:2012 Rule 2.x leaves to the compiler:

1. **Reachability** — reject any statement that cannot be reached on any control-flow path from
   the function entry (proposed **E0706 — unreachable code**). MISRA Rule 2.1.
2. **Liveness** — reject any variable that is defined but never used (proposed **E0709 — unused
   variable**; code not yet allocated). MISRA Rule 2.2's own definition of dead code — "an
   operation whose removal would not affect program behavior" — already covers a variable whose
   initialization and storage are never read. See **Unused objects (liveness)** below.

They ship as **two phases of one analyzer**, reachability first:

| Phase | Rule         | Code  | Issue |
| ----- | ------------ | ----- | ----- |
| 1     | Reachability | E0706 | #849  |
| 2     | Liveness     | E0709 | #1107 |

**Why one rule, and why that order.** The ordering is a correctness contract, not a
preference. Because E0706 is a hard error (Resolved Question 5) and is decided first,
**liveness never sees a program that contains unreachable code.** That is precisely what
lets Phase 2 stay a pure symbol-use walk with no control-flow logic of its own: without the
guarantee, liveness would have to decide for itself whether a read sitting in dead code counts
as a use, and would duplicate Phase 1's reasoning to do it.

> **Superseded rationale (recorded so it is not reintroduced).** An earlier draft justified
> bundling by claiming that splitting would violate the project's "No Duplicate Code Paths"
> rule. That argument does not hold: reachability walks control flow and liveness tracks symbol
> reads, so they share no decision and no primitive, and separating them would not have
> duplicated anything. The real reason is the ordering guarantee above.

### Coverage — reachability (E0706)

- code after an unconditional `return`;
- code after a `forever` loop (ADR-068);
- code after an `if`/`else` where both branches diverge;
- code after a `switch` with a `default` where every case diverges.

### Unused objects (liveness) — #1107 (proposed E0709)

C-Next performs **no liveness analysis today**. A variable defined but never used transpiles
cleanly, for locals and globals alike:

```cnx
u32 counter <- 0;
void t() {
    u32 x <- counter.bit_length;   // .bit_length is compile-time (32); counter's value never read
}
```

transpiles (verified) to `uint32_t counter = 0U;` with no diagnostic — `counter` is allocated,
initialized, and never read or written. Both `counter` (read only via a compile-time property)
and a plain dead local like `u32 dead <- 0;` are accepted.

**Coverage rule: exhaustive over everything C-Next can see, and a use from C/C++ is a use.**

C-Next cannot take responsibility for code it cannot read, so "unused" is decided against the
widest view available — never against a guess:

| Object                              | Rule                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Local variable                      | Always checked. A local is only readable inside its own body, which C-Next fully sees.                                                 |
| Global absent from generated header | Always checked. It is private to the translation unit, so C-Next sees every possible use.                                              |
| Global present in generated header  | Public surface. Flagged only when a project view exists **and** no discovered `.c`/`.cpp`/`.cnx` translation unit references the name. |
| Any object, pure C-Next project     | Always checked. With no `.c`/`.cpp` in the discovered set, nothing external can reference anything.                                    |

A **project view** means the transpiler can enumerate the project's other translation units —
from `compile_commands.json` — the build-system-agnostic database every build system emits —
or from a C/C++ entry point. When `cnext` is handed a single `.cnx` on the command line it has no
such view, and an exported global is therefore **not** flagged. Under-reporting in that case is
deliberate: a false positive on a legitimately exported global would be a bug the developer
cannot fix without disabling the rule.

**A read from C or C++ counts as a use.** A C-Next global reaches C/C++ through the generated
header, so the check is "does any discovered translation unit reference this name?", not "does
any `.cnx` reference it?".

**Compile-time property access is NOT a use** (resolved — see _Resolved Questions_). A variable
read only through `.bit_length` / `.element_count` (ADR-058) is dead: those read a property of
the _type_, resolved at compile time, and never touch the object's storage.

**Explicitly out of scope for this rule's first version** (each already has its own MISRA row and can be sequenced
later): unused type declarations (2.3), unused tag declarations (2.4), unused function
declarations (2.6), unused function parameters (2.7). This ADR's liveness pass targets
_objects/variables_ first; the others can join the same analyzer once the primitive exists.

### Architecture (proposed)

- New analyzer `ReachabilityAnalyzer` in `src/transpiler/logic/analysis/`, registered in
  `runAnalyzers.ts` like the existing analyzers (listener + `analyze(tree)` returning
  `IAnalyzerError[]`).
- **Single source of truth for divergence.** The "is this statement divergent?" decision is
  owned by **one** primitive. ADR-068 landed that primitive in the all-paths-return rule,
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

**Phase 2 (liveness) — reuse the existing discovery machinery, do not rebuild it.** The pieces
needed to decide "does any C/C++ translation unit read this global?" already exist:

- classify a source as C or C++
- tell a C-Next-generated header from a hand-written one
- enumerate the project's other translation units
- walk a C/C++ entry point's includes

One gap is real and should be scoped as build work rather than assumed away. What exists walks
**from** a C/C++ entry point **into** `.cnx` sources, to decide what to transpile. Liveness needs
the **inverse**: given a C-Next global, which translation units mention it. Nothing builds that
direction today, and the difference is not a detail — the existing direction answers "what must
I compile", the needed one answers "who reads this", and no amount of the first yields the
second.

### Proposed error codes

| Code  | Meaning          | Status                                               |
| ----- | ---------------- | ---------------------------------------------------- |
| E0706 | Unreachable code | Free, reserved for this ADR (see Research Finding 4) |
| E0709 | Unused variable  | Not yet allocated — confirm free before use          |

## Relationship to ADR-068

`forever` (ADR-068) and this analysis are **independent** — neither strictly requires the other:

- A reachability pass can already analyze a constant-true loop (`while (1 = 1)`) without the
  `forever` keyword.
- `forever`'s own "no code after the loop" rule needs only the **minimal** divergence check, not
  this full pass.

But they **share the divergence primitive**, and the agreed sequencing is:

1. **ADR-068 first** — introduces the divergence primitive and ships `forever`. Small,
   **non-breaking** (only accepts more programs).
2. **ADR-069 second (this ADR)** — generalizes consumption of that primitive into the full
   reachability pass. **Breaking.**

## Breaking-Change Note

Turning unreachable code into an error is a **breaking change**: any existing code with a dead
trailing statement starts failing. The known instance is the dead `return 0;` in
`examples/nucleo-f446re/blink.cnx` — which **ADR-068 already removes** by converting that
function to `void main()` with a `forever` loop. Sequencing ADR-068 before ADR-069 means the one
known offender is gone before the rule that would flag it turns on. A repo-wide `npm run unit`
(which transpiles every shipped example) should gate
the rule's introduction.

**Phase 2 (liveness) has its own offender, and it is not clean yet.**
`examples/bit_test.cnx` fails E0709 as written: its globals `counter` and `buffer` are read only
through compile-time properties (not a use — Resolved Question 1), and its locals `bit3`,
`field`, `arrLen`, `flagBits` and `counterBits` are written and never read at all. The locals are
flagged no matter how Resolved Question 1 had gone. That example must be rewritten — so that it
still demonstrates ADR-058's properties while actually consuming the values it computes — before
Phase 2 can turn on. The same `npm run unit` gate applies.

## Research Findings — round 1 (2026-06-28, #849)

Code-verified investigation of the then-current `main` (post ADR-068 implementation). Status
stays **Research** — nothing below is approved or implemented.

> A second round on 2026-08-23 closed every remaining question; its conclusions are written into
> _Decision_, _Unused objects (liveness)_, _Architecture_ and _Resolved Questions_ rather than
> repeated here. In particular finding 5's outstanding item is now settled — see Resolved
> Question 4.

1. **Blocker cleared — ADR-069 is now unblocked.** The sequencing blocker #1074 (ADR-068
   `forever` core) is **closed** (2026-06-27); `forever` is implemented (commit `80dc4123`,
   `feat: implement forever infinite-loop statement`). The dead `return 0;` offender in
   `examples/nucleo-f446re/blink.cnx` is gone — that function now ends `void main() { setup();
forever { loop(); } }`, with no statement after the `forever`. Every shipped example is
   transpiled in CI, so that corpus can gate the rule's rollout.

2. **The divergence primitive landed, but is NOT verbatim-reusable (key finding).**
   ADR-068's divergence primitive answers _"does this path return a value?"_, and for a bare
   `return;` it answers **no**. For reachability a bare `return;` **is** divergent: `return;
side();` leaves `side()` unreachable even in a `void` function. The two predicates therefore
   agree everywhere except one leaf, which is the most dangerous shape a shared primitive can
   have — reusing it as-is looks correct and silently misses unreachable code after a bare
   `return;`.

   Resolution: the shared base is _"control cannot fall through"_ — any `return`, `forever`, an
   exhaustive `if`/`else`, a `switch` with `default` where all cases diverge. Returning a
   **value** is that property plus one more condition, not a separate question. One decision
   site, two rules reading it.

3. **Where the rule belongs.** Reachability is a structural control-flow property of the parse
   tree, decided before any code is generated — not a codegen concern. E0707 (disguised loops,
   #1075) was implemented on the codegen side; this rule should follow ADR-067's placement
   instead. The distinction is not filing: a codegen-side check cannot run on a program that
   fails to generate, and unreachable code is exactly the kind of defect that coexists with
   other errors.

4. **Error code E0706 is free and already reserved** for this ADR (`docs/error-codes.md`:
   _"E0706 reserved for ADR-069 unreachable code"_). E0705 = `forever` in non-void; E0707 =
   disguised loop. Open question on the code number is **resolved: use E0706.**

5. **Post-preprocessor concern is mild.** Analyzers run on the directly-parsed `.cnx` tree
   (`CNextSourceParser.parse(source)` in `Transpiler._transpileFile`); C-Next conditional
   compilation is a header/include mechanism, not intra-body statement deletion. Structural
   reachability over the parsed function body is therefore well-defined. _(The outstanding
   confirmation — that no source-level construct removes statements from a function body — was
   completed on 2026-08-23 against the grammar and the preprocessor tests. See Resolved
   Question 4.)_

## Resolved Questions

All design questions are closed as of 2026-08-23. The status stays **Research** pending final
review; nothing here is implemented.

### 1. Does compile-time property access count as a use? — **No**

A variable read only through `.bit_length` / `.element_count` (ADR-058) is **dead**. Those
properties are resolved at compile time from the _type_ and never touch the object's storage, so
strict storage liveness says the object is unused. This also matches ADR-070's stance that there
is no opt-out and no curated exception — exceptions to rules are where bugs come from.

**Consequence, recorded so it is not a surprise at build time:** `examples/bit_test.cnx` must be
rewritten before Phase 2 lands, and it needs rewriting under _either_ answer. Its globals
`counter` and `buffer` are read only through compile-time properties, but its locals `bit3`,
`field`, `arrLen`, `flagBits` and `counterBits` are written and **never read at all** — those are
flagged regardless of how this question is answered. Every shipped example is transpiled in
CI, so this is enforced rather than optional.

### 2. Cross-translation-unit globals — **exhaustive over what C-Next can see; C/C++ use counts**

See the table under _Unused objects (liveness)_. In short: locals and header-absent globals are
always checked; a header-exported global is flagged only when a project view exists and no
discovered translation unit references it; a project with no `.c`/`.cpp` at all is checked
exhaustively. "All globals unconditionally" is rejected as overreach — C-Next cannot take
responsibility for code it cannot read.

### 3. Function calls that never return — **out of scope, deferred**

Without a `never`/bottom type (ADR-068, Alternative 1), a future `panic()` cannot be treated as
divergent, so code after it would be wrongly considered reachable. This ADR is scoped to
_structural_ divergence (`return` / `forever` / exhaustive `if` / `switch`). Revisit if a bottom
type lands. This is a deliberate deferral, not an unknown.

### 4. Conditional compilation interaction — **fully resolved: no interaction exists**

No source-level construct can delete a statement from a function body, so structural reachability
over a parsed function body is well-defined. Verified against the grammar and the test suite:

- `grammar/CNext.g4` — `program: (includeDirective | preprocessorDirective)* declaration* EOF`.
  Directives are legal only at the top of a compilation unit, **before** any declaration.
- `grammar/CNext.g4` — the `statement` rule has no directive alternative at all, so `#ifdef`
  cannot appear inside a block.
- `tests/preprocessor/nested-ifdef.expected.error` — interleaving `#ifdef` between declarations is
  a **parse error today** ("extraneous input '#ifdef DEBUG'"), not a supported construct.
- `tests/preprocessor/conditional-compilation.test.cnx` states it in its own header comment:
  _"Inline conditionals (around code blocks) are handled by the C preprocessor"_ — that is, after
  C-Next has emitted.

This supersedes the "partially resolved" note from 2026-06-28, whose remaining item was exactly
this confirmation.

### 5. Rollout — **both phases straight to error, no flag**

Neither phase lands behind a flag. This matches how every comparable diagnostic has shipped:
ADR-067 (E0704) and ADR-068 (E0705 / E0707) both went straight to hard errors with no migration
period. C-Next is pre-1.0, the one known reachability offender is already gone (see
_Breaking-Change Note_), and `npm run unit` gates the rollout by transpiling every example.
Phase 1 must be a hard error for the ordering contract in _Decision_ to hold.

### 6. Error code — **E0706** (resolved 2026-06-28)

Free and already reserved for this ADR in `docs/error-codes.md`. See Research Finding 4.

**E0709 confirmed free (2026-08-23)** and now reserved for Phase 2 in `docs/error-codes.md`
alongside E0706. The `E07xx` block holds E0701–E0705 and E0707 as implemented, E0706 and E0709
reserved for this ADR, and E0708 reserved for ADR-070; E0709 appeared nowhere in the repository
outside this ADR before being reserved.

### 7. Back-reference ADR-067 — **done**

ADR-067's _Related ADRs_ now lists ADR-069.

## References

- ADR-067 (All-Paths-Return — provides the dual `definitelyReturns` machinery)
- ADR-068 (Forever Loops — provides the divergence primitive this pass consumes)
- ADR-066 (DO-178C Compliance — frames dead-code detection as a certification requirement)
- ADR-070 (Return-Value Use — sets the "no opt-out, no curated exception" precedent this ADR follows)
- ADR-058 (Explicit Length Properties — defines the compile-time properties that are NOT uses)
- Issue #849 (MISRA C:2012 Rule 2.2 — No dead code)
- Issue #1107 (unused variables — Phase 2)
- `docs/misra-compliance.md` (Rules 2.1 and 2.2, both "Not Enforced")
- `docs/error-codes.md` (E0706 reserved for this ADR)
- `grammar/CNext.g4` and `tests/preprocessor/nested-ifdef.expected.error` (evidence for Resolved Question 4)
- The phase ordering above (reachability before liveness) is a correctness contract, not a preference — see `### Architecture (proposed)`
