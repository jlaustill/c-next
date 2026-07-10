# ADR-062: Sink-Aware Auto-Const for Array Parameters

**Status:** Proposed
**Date:** 2026-07-07
**Decision Makers:** C-Next Language Design Team
**Amends:** ADR-006 (Simplified Reference Model) — array-parameter auto-const behavior
**Supersedes:** the blanket approach introduced in #986 ("array params no longer get auto-const")

## Context

C-Next infers `const` on pass-by-reference parameters a function only reads
("auto-const", Issue #268). A parameter is const-qualified unless it is _modified_ —
directly (`p[i] <- x`) or transitively (passed to a callee that modifies its
corresponding parameter, via the `TransitiveModificationPropagator`, Issue #269).

**#986 turned this off for arrays entirely.** The trigger was C-API passthrough:

```cnx
void sendFrame(u8[8] payload) {
    canBusWrite(payload);          // external C API: void canBusWrite(uint8_t* buf)
}
```

Auto-const made `sendFrame`'s signature `void sendFrame(const uint8_t payload[8])`,
which decays to `const uint8_t*`. Forwarding that to `canBusWrite(uint8_t*)` **discards
the `const` qualifier** — a warning in C, a hard error in C++. The fix shipped as a
blanket rule: _arrays never auto-const; only explicit `const` in source qualifies them._

### Why the blanket rule is a shortcut

The passthrough break has a precise cause: the transitive modification analysis tracks
mutation through **C-Next callees it can see the body of**, but an **external** callee has
no body, so it never contributes a modification — the forwarded array looks read-only and
is wrongly const-qualified. The correct signal was available all along: the external
callee's **signature**. A non-`const` pointer parameter is, by contract, a "may modify"
sink — regardless of what the implementation does. The blanket rule discards a precise,
locally-available signal (callee parameter const-ness) in favor of "give up on all arrays."

### What the blanket rule costs

1. **Const-correctness by default is lost.** Genuinely read-only array parameters — the
   common `decode(const u8[8] data, ...)` shape — are no longer const unless hand-annotated.
2. **MISRA C:2012 Rule 8.13** ("a pointer should point to a const-qualified type whenever
   possible") moves from _satisfied automatically_ to _opt-in per parameter_.
3. **The deviation/migration signal is thrown away** (see Decision) — the one place the
   transpiler could tell you _why_ a buffer can't be const, and what to do about it.

C-Next's no-raw-pointers / no-address-of design makes the precise analysis uniquely
tractable: an array can only escape a function by being passed as a call argument. There is
no `&buf`, no pointer arithmetic, no aliasing through casts. **The complete set of a
parameter's sinks is exactly its set of call-site argument positions** — a closed,
statically enumerable set.

## Decision

Restore array parameters to the normal auto-const model, and extend the modification
analysis to treat **an external callee's non-`const` pointer parameter as a mutation
sink**. Auto-const is then decided by dataflow, per parameter:

| Situation                                                                      | Result                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Read-only; never forwarded to a non-`const` sink                               | **auto-`const`** (silent — just correct)                            |
| Forwarded (directly or transitively) to a non-`const` pointer sink             | **stays mutable** + emit a **deviation diagnostic** (below)         |
| Source declares explicit `const`, but a non-`const` sink exists                | **hard error** — the asserted guarantee is contradicted by dataflow |
| Sink cannot be resolved (function pointer, unknown callback, interop boundary) | **stays mutable** (fail-safe), diagnostic notes "unresolved sink"   |

### The deviation diagnostic is a first-class feature, not a warning to suppress

When a parameter is denied auto-const because it reaches a non-`const` sink, the transpiler
emits a located, rationalized record:

```
note[const-sink]: parameter `payload` of `sendFrame` not const-qualified
  (MISRA C:2012 Rule 8.13 not applied) — forwarded to non-const parameter `buf`
  of `canBusWrite` at sendFrame.cnx:2
```

This is deliberately valuable, in two ways:

1. **Automated MISRA deviation evidence.** Rule 8.13 is advisory; a compliant project must
   _document every deviation with rationale and location_. This diagnostic **is** that
   record, generated mechanically — no hand-maintained deviation ledger.
2. **A C→C-Next migration worklist.** Every line names an external (typically C/C++)
   consumer whose mutable-pointer signature is the _only_ thing blocking const-correctness.
   That is a prioritized list of "convert this consumer to C-Next next, and the buffer
   becomes `const` for free." For a project mid-migration this signal is the point, not noise.

The diagnostic is informational (never fails the build), shown by default, and suppressible
with **`--quiet`** (for builds that don't want the deviation/migration stream); it should
also be aggregatable into a report for audit sign-off. The **fail-safe** direction guarantees
it can never break a build that #986 compiled: any uncertainty resolves to "mutable."

## Rationale

- **Reuses existing machinery.** The change is an extension of the
  `TransitiveModificationPropagator`, not a new pass. External callees are absent from the
  `modifiedParameters` map today; seeding each external callee's modified-set with the names
  of its **non-`const` pointer parameters** makes `isParamModified(callee, …)` return `true`
  for those, and the existing fixed-point iteration propagates the mutability requirement
  backward through every forwarding chain unchanged.
- **Feasible because of C-Next's safety model.** No `&`, no pointer arithmetic, no casts to
  alias → sinks are exactly the argument positions. The analysis is sound without escape
  analysis that would be intractable in raw C.
- **`const`-by-default is the MISRA-aligned default;** deviations become the exception,
  documented automatically.

## Implementation

1. **Seed external sinks.** Where the call graph is built (`CallExprGenerator`, the
   `ICallInfo` entries feeding `TransitiveModificationPropagator`), for each callee resolve
   its parameter const-ness from its declaration (C-Next signature or parsed C/C++ header,
   per ADR-061 interop). Pre-seed `modifiedParameters[callee]` with every parameter whose
   type is a **non-`const` pointer/array**. The fixed-point `propagate()` then requires no
   change.
2. **Remove the blanket.** In `ParameterInputAdapter._buildArrayInputFromAST`, delete the
   hard-coded `isAutoConst: false` (and its `_buildArrayInputFromSymbol` counterpart) so
   array parameters use the same `isAutoConst = !isModified && !isConst` path as structs.
3. **Contradiction error.** When a parameter carries explicit source `const` but the
   analysis marks it modified via a sink, raise a diagnostic error naming the parameter and
   the sink.
4. **Deviation diagnostic.** When auto-const is denied due to a resolved non-`const` sink,
   emit the `note[const-sink]` record with parameter, sink parameter, callee, and location.
   Shown by default; suppressed under `--quiet`.
5. **Unresolved sinks** (function-pointer params, callbacks, opaque/interop boundaries):
   treat as a mutation sink (fail-safe), tag the diagnostic "unresolved sink."

## Consequences

**Positive**

- Read-only array parameters are `const` again by default (MISRA 8.13 satisfied for free).
- The transpiler emits an auditable MISRA-8.13 deviation ledger and a C→C-Next migration
  worklist as a byproduct of the const analysis.
- Explicit `const` on an array is now _verified_ against dataflow rather than trusted.
- Uses existing infrastructure; the propagator core is unchanged.

**Negative / risks**

- **Transitive analysis must be correct.** Unlike the blanket rule (which can never wrongly
  const-qualify), a bug in sink seeding or propagation could const-qualify a buffer that is
  in fact forwarded to a mutable API. Crucially, this failure mode is a **deterministic
  compile-time build error** — the generated C/C++ won't compile the instant a `const` buffer
  meets a non-`const` sink — caught at transpile/build time, so it can never silently reach
  production. That bounded, loud failure mode is what makes the risk acceptable. Mitigated
  further by the fail-safe default and a dedicated test matrix (direct sink, N-deep forwarding
  chain, const sink, unresolved sink, explicit-const contradiction).
- **Header const-ness must be trusted.** Legacy C APIs that take `uint8_t*` but only read
  will (correctly, per their contract) deny auto-const. The diagnostic explains it; the
  remedy is fixing the upstream signature or converting the consumer — both desirable.
- Slightly less predictable than "arrays are never auto-const" — mitigated by the diagnostic
  making every decision explicit.

## Alternatives Considered

1. **Status quo (#986 blanket).** Simple, zero false-positives on compilation, and treats
   "explicit `const` is clearer intent" as a feature. Rejected because it forfeits
   const-by-default, MISRA-8.13 automation, and the migration signal — the analysis is both
   feasible and high-value here.
2. **Always require explicit `const` on all pass-by-reference params (not just arrays).**
   Consistent, but discards auto-const's ergonomics everywhere and still produces no
   deviation/migration signal. Rejected.
3. **Sink-aware without the diagnostic** (silently keep mutable). Rejected — the diagnostic
   is the feature (see Decision); silence would repeat #986's core mistake of discarding the
   signal.

## References

- ADR-006 — Simplified Reference Model (auto-const foundation)
- ADR-061 — C Library Interop (external signature resolution)
- Issue #268 — auto-const inference; Issue #269 — `TransitiveModificationPropagator`
- #986 — the blanket array auto-const removal this supersedes
- MISRA C:2012 Rule 8.13 (advisory) — const-qualify pointers to unmodified data
