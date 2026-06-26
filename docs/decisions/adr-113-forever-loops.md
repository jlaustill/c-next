# ADR-113: Forever Loops

**Status:** Research
**Date:** 2026-06-26
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-026 (Break and Continue), ADR-027 (Do-While), ADR-112 (All-Paths-Return), ADR-114 (Dead-Code / Reachability Analysis)

## Context

C-Next has no dedicated construct for an intentionally infinite loop. Because loop
conditions must be explicit comparisons (E0701 — bare booleans and bare constants are
rejected), the only way to write "loop forever" today is a hack:

```cnx
while (1 = 1) {   // `1 = 1` is equality in C-Next, i.e. `1 == 1`
    loop();
}
```

which transpiles to:

```c
while (1 == 1) {
    Main_loop();
}
```

This is unsatisfying for a "safer C": the intent (_this loop never ends_) is buried in
an arithmetic identity that the transpiler cannot recognize as deliberate. Two concrete
problems follow from the transpiler not understanding the loop is infinite:

1. **It forces dead code.** `ReturnPathAnalyzer` (ADR-112) treats a `while` body as
   _possibly skipped_, so a non-void function whose only terminal path is `while (1 = 1)`
   fails with **E0704** unless an unreachable trailing `return` is added. The project's own
   flagship example ships exactly this dead code:

   ```cnx
   // examples/nucleo-f446re/blink.cnx:286
   i32 main() {
       setup();
       while (1 = 1) {
           loop();
       }
       return 0;          // unreachable — present only to satisfy E0704
   }
   ```

2. **It cannot express divergence.** There is no way to tell the compiler "control never
   leaves this loop," so the compiler cannot reason about the code around it (see ADR-114).

### Relevant existing constraints

- **No `break` / `continue` (ADR-026).** A loop body has no structural early exit. The
  _only_ way out of any loop is a `return` from the enclosing function. This makes a
  conditionless loop **unconditionally divergent** — a stronger guarantee than in C or Rust,
  where `break` can escape. There are zero edge cases for the analyzer to consider.
- **All-paths-return (ADR-112).** A `do-while` counts as a guaranteed return (its body always
  runs at least once); `while`/`for` never do. The analyzer makes no attempt to prove a loop
  is infinite.

### How other languages model "never returns"

Research across seven languages (Rust, Ada, C/C++, Zig, Kotlin, Swift, Verilog) found that
**no mainstream typed language syntactically restricts its infinite-loop construct by the
enclosing function's return type.** They split into two camps:

| Mechanism                                              | Languages                                                 | How an infinite loop fits a value-returning function                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Bottom / never type** (coerces to every type)        | Rust `!`, Zig `noreturn`, Kotlin `Nothing`, Swift `Never` | The loop expression has a bottom type that is a subtype of all types, so it is valid in any return context with no special rule |
| **Out-of-band contract** (attribute / aspect / pragma) | C `_Noreturn`, C++ `[[noreturn]]`, Ada `No_Return`        | The loop itself is unrestricted; a function with an infinite loop is allowed under any return type                              |

- Swift deliberately **removed** its `@noreturn` _attribute_ (SE-0102) in favor of the `Never`
  _type_, because the attribute did not compose with the rest of the type system. This is the
  clearest industry signal that the bottom-type approach is the converged-upon design.
- Verilog is the only surveyed language that uses the **keyword `forever`** — it confirms the
  word reads naturally, but offers no guidance on return types (hardware has none).

The proposed C-Next rule below (`forever` only in `void` functions) is therefore **novel**.
The justification is that it is the _simplest sound_ option and, per the repo audit, costs
nothing today (see "Migration Impact").

## Decision (Proposed — Research)

> This ADR is in **Research** status. The direction below reflects the current design
> conversation; nothing here is approved or implemented. Open questions are listed explicitly.

Add a dedicated infinite-loop statement:

```cnx
forever {
    loop();
}
```

### Proposed semantics

1. **Lowering.** `forever { … }` transpiles to `for (;;) { … }` — the idiom MISRA C:2012
   explicitly permits as an infinite loop (Rule 14.3 carve-out), with no controlling
   expression to be flagged as invariant.
2. **Divergent.** Because C-Next has no `break`/`continue` (ADR-026), `forever` never completes.
   The all-paths-return analyzer (ADR-112) treats it as a **divergent statement** — a terminal
   path, like an unconditional `return`. A function whose every path either returns a value or
   diverges via `forever` satisfies E0704 with **no dead trailing return**.
3. **`void`-only.** A `forever` loop may appear **only in a function with a `void` return
   type** (proposed **E0705**). A value-returning function that loops forever can never honor
   its return type; rather than silently accept it (Rust) or force dead code (today), C-Next
   rejects the combination outright. Functions that "loop until they have a value to return"
   are _not_ forever loops — by ADR-026's own philosophy they express the exit as a `while`
   condition:

   ```cnx
   u8 readUntilNonzero() {
       u8 b <- 0;
       while (b = 0) {        // the trigger is explicit
           b <- readByte();
       }
       return b;              // reachable, not dead
   }
   ```

4. **No code after `forever`.** Any statement following a `forever` loop in the same block is
   unreachable and is an error. This is the first concrete consumer of the divergence primitive
   that ADR-114 (Dead-Code / Reachability Analysis) generalizes — see "Relationship to ADR-114."

### Proposed error codes (not yet allocated)

| Code  | Meaning                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------- |
| E0705 | `forever` loop in a non-`void` function (use `while` + condition, or make the function `void`) |

(Unreachable-code-after-`forever` is proposed to be reported by ADR-114's reachability code,
under the same code that flags all unreachable statements, rather than a `forever`-specific one.)

## Relationship to ADR-114

`forever` and general dead-code detection are **independent** (neither strictly requires the
other) but **share one primitive**. The decision (recorded in the design discussion) is **two
ADRs sharing a single divergence primitive**:

- **This ADR (113)** introduces the **"divergent statement"** concept into `ReturnPathAnalyzer`
  (a `forever` loop is divergent) and the minimal rule "no code after `forever`." Small,
  self-contained, **non-breaking** (it only accepts more programs — those that previously
  needed a dead trailing return).
- **ADR-114** _generalizes the consumption_ of that same primitive into a full reachability
  pass (unreachable code after `return`, after fully-returning `if`/`else`, etc.). It is a
  **breaking** change and is independently motivated by MISRA 2.1/2.2 and DO-178C.

Adhering to a single shared primitive (rather than ADR-114 re-deriving reachability) is required by
the project's "No Duplicate Code Paths" rule.

## Migration Impact

A full audit of the repository (1,028 `.cnx` files in `examples/` and `tests/`) found
**exactly one** infinite loop: `examples/nucleo-f446re/blink.cnx`, the `i32 main()` shown
above. Every Arduino `setup`/`loop` and FreeRTOS task is already `void`. That single case
converts to `void main()` with zero loss of meaning:

```cnx
void main() {
    setup();
    forever {
        loop();
    }
}                          // no return type to honor, no dead code
```

So the `void`-only restriction costs nothing in the current codebase. (`void main()` already
transpiles correctly.)

## Forbidding the Disguised Infinite Loop (follow-on)

Once `forever` exists, the current `while (1 = 1)` hack has **zero** legitimate use. The natural
follow-on is a compile error on an always-true loop condition that steers the author to
`forever`, e.g.:

```
error[E0707]: loop condition is always true
  help: this is an infinite loop — write `forever { … }` instead
```

(Error code `E0707` is a proposal, not yet allocated.)

### Prior art

Steering a disguised infinite loop toward a dedicated construct is an established pattern:

| Tool                                   | Behavior                                                                                                                 | Level    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| **Rust `while_true`** (built-in rustc) | Detects `while true`; message _"denote infinite loops with `loop { … }`"_                                                | warn     |
| **Go Staticcheck `S1006`**             | `for true {}` → suggests the dedicated `for {}`                                                                          | lint     |
| **ESLint `no-constant-condition`**     | default `allExceptWhileTrue`: flags `while (1==1)`, **exempts** `while (true)`                                           | lint     |
| **MISRA C:2012 Rule 14.3**             | "Controlling expressions shall not be invariant"; blesses `true`/`1`/`for(;;)`, but a `1==1` comparison is non-compliant | Required |
| SonarQube `S2189`                      | _Opposite_ stance — flags `while(true)` as a likely bug                                                                  | —        |

Two consistent findings:

1. **Elsewhere it is a warning, not a hard error.** Rust, Go, ESLint, C# all warn; no mainstream
   toolchain blocks the build by default. MISRA is the only "must," and it _permits_ the idiom.
2. **`while (1 == 1)` is treated differently from `while (true)`.** Everywhere, the bare literal
   `true`/`1`/`for(;;)` is the _blessed intentional idiom_, while a constant _comparison_ like
   `1==1` reads as an _accidental invariant / likely logic bug_ (ESLint flags it, MISRA's blessed
   list excludes it).

There is also a recurring _semantic_ payoff: Rust's `loop {}` and Go's `for {}` are recognized by
the compiler as diverging/terminating, improving flow analysis — exactly the divergence primitive
this ADR introduces.

### Why C-Next can make it a single-tier error

Every other tool needs a _two-tier_ rule (bless `while(true)`, flag `while(1==1)`). **C-Next does
not** — `E0701` already forbids bare booleans/constants as conditions, so `while (true)` is not
even writable today. C-Next's _only_ infinite-loop form is `while (1 = 1)` — precisely the
constant-_comparison_ form that ESLint and MISRA flag as the suspicious case. With no literal-true
idiom to protect, the two tiers collapse into one rule: **an always-true loop condition is an
error; if you meant to loop forever, use `forever`.**

That rule is exactly **MISRA Rule 14.3**, which C-Next currently marks **"Not Enforced"**
(`docs/misra-compliance.md`). So the `forever` steering is the loop-true _facet_ of 14.3. A
hard error here is stricter than any precedent, but defensible for C-Next: the language is
hard-error-first, `E0701` already hard-errors the adjacent case, MISRA 14.3 is Required, and
post-`forever` the form has no legitimate use.

### Scope notes

- Catching only the literal `1 = 1` is trivial; catching `2 = 2`, `5 > 3`, `true = true`, and
  named-constant comparisons requires constant folding (i.e. real invariant analysis).
- Full MISRA 14.3 is broader than infinite loops (always-_false_ conditions, invariant non-loop
  `if`/`for`). The `forever` steering is one facet; full 14.3 enforcement is a separate, larger
  effort worth its own tracking.

## Alternatives Considered

1. **A `never` / bottom type (Rust `!`, Swift `Never`).** The idiomatic modern choice; lets a
   `forever` — or a future `panic()`-style diverging function — appear in any return context,
   compose in expressions, and drive exhaustiveness checks. **Deferred, not rejected:** it
   requires adding a real bottom type to the type system and specifying its coercion against
   every other feature (overflow modes, atomics, structs-by-ref) — a large, safety-sensitive
   surface. If diverging functions (panic handlers, fault traps, non-returning ISR dispatchers)
   land on the roadmap, the `void`-only rule becomes a stepping-stone to revisit. Recorded here
   so that decision is explicit.
2. **Pure syntactic sugar.** `forever` lowers to a loop but flow analysis is unchanged, so a
   non-void function still needs a dead trailing return. Rejected: it leaves the E0704
   dead-code wart in place, which is half the motivation.
3. **Keyword `loop` (Rust/CoffeeScript) instead of `forever` (Verilog).** Open question — see
   below.

## Open Questions

- **Keyword:** `forever` vs `loop`. `forever` matches Verilog and is unambiguous; `loop`
  matches Rust/Ada/CoffeeScript and is shorter. Needs a decision.
- **`void`-only vs bottom type:** confirm the `void`-only rule for v1, with the bottom type as
  a documented future fork (Alternative 1).
- **Diagnostic wording for E0705:** should it actively suggest the `while`-with-condition
  rewrite and the `void` conversion?
- **Grammar placement:** add `foreverStatement` as a new alternative in the `statement` rule
  (alongside `whileStatement`/`forStatement`); new keyword token `FOREVER`.
- **Disguised-loop steering (see section above):** hard error vs warning, and whether to ship the
  trivial literal-`1 = 1` slice first or build full MISRA 14.3 invariant analysis. Proposed `E0707`.
- **Back-reference ADR-112.** When this ADR is accepted/implemented, update ADR-112's
  _Related ADRs_ to include ADR-113 — this ADR introduces the "divergent statement" concept into
  ADR-112's `definitelyReturns` machinery. (Documentation counterpart, not a code change.)

## References

- ADR-026 (Break/Continue rejected — why a conditionless loop is unconditionally divergent)
- ADR-112 (All-Paths-Return — the analyzer this extends with a divergence primitive)
- ADR-114 (Dead-Code / Reachability Analysis — generalizes the divergence primitive)
- MISRA C:2012 Rule 14.3 (infinite-loop idiom carve-out for `for(;;)`)
- Swift SE-0102 (removal of `@noreturn` in favor of the `Never` bottom type)
