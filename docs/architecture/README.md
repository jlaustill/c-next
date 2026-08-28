# C-Next Transpiler Architecture

**Status: Target.** This document describes where the transpiler is going, not what
`main` does today. [ADR-053](../decisions/adr-053-transpiler-pipeline-architecture.md)
(Implemented) describes the current pipeline, which this replaces.

Nothing here is an approved ADR yet. The number band — and therefore whether this ships
in v1 or v2 — is an open question recorded at the end.

Every measurement below names the commit it was taken at. Numbers move; a number without
a SHA is a claim, not a fact.

---

## Why this document exists

A third of the open backlog is one bug, wearing different clothes.

Of 97 open issues, 30 match the signature "the same decision is made in two places, and
they agree only by coincidence." The pattern has been fixed four times at four individual
sites — #1130, #1139, #1200, #1207 — and survived each time, because each fix corrected a
derivation instead of removing the need to derive.

Three defects filed during the audit that produced this document show the same shape at
three altitudes:

|                                                          | what it is                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| [#1285](https://github.com/jlaustill/c-next/issues/1285) | a **fact** with no home, so every site recomputes it             |
| [#1297](https://github.com/jlaustill/c-next/issues/1297) | a **rule** with no teeth, so every layer ignores it              |
| [#1298](https://github.com/jlaustill/c-next/issues/1298) | a **guard** keyed on identity, so it cannot fire on its own case |

In all three, something looks enforced and is not. That is the failure this architecture
is designed against, and it is why every invariant below ships with the mechanism that
makes violating it hard **and** the gate that fails when someone does anyway.

### The two structural causes

**1. Four representations of the same symbols.** Each layer boundary discards the
discriminator the next layer needs, so every consumer reconstructs from strings what the
model already knew.

|     | representation    | shape                                                                    |
| --- | ----------------- | ------------------------------------------------------------------------ |
| 1   | `TSymbol[]`       | discriminated union — carries `kind`, `scope`, identity                  |
| 2   | `SymbolTable`     | 11 private indices                                                       |
| 3   | `ICodeGenSymbols` | **24 string-keyed collections — `kind` encoded as which set you are in** |
| 4   | `CodeGenState`    | 36 more maps, several copied from 3                                      |

`TSymbolInfoAdapter` performs the lossy step. The parallel `known*` sets **are** a `kind`
field, spelled as set membership — which is why [#1287](https://github.com/jlaustill/c-next/issues/1287)
cannot be fixed in isolation: the kind is discarded at the moment of lookup, so nothing
downstream retains what a diagnostic would need to say.

**2. `state/` is not a layer, it is the organ the disease lives in.** `.dependency-cruiser.cjs`
declares `logic-cannot-import-output`, and CI reports `✔ no dependency violations found`.
But `state/CodeGenState.ts` imports 7 types from `output/`, and 10 `logic/analysis/`
modules import `CodeGenState` — so `logic/ → state/ → output/` is live, and the rule
matches direct edges only ([#1297](https://github.com/jlaustill/c-next/issues/1297)).

`CodeGenState` can be the place facts get stashed instead of carried **precisely because
it sits outside the layer model that would forbid it.**

---

## Principles

1. **A layer owns a fact if it is the only place that fact may be _authored_.** Everything
   downstream may read it; nothing downstream may recompute it.
2. **Every pass emits a frozen artifact.** The next pass's only input is that artifact.
3. **Freezing prevents writes; the disease is reads that reconstruct.** Immutability alone
   is insufficient — see [Reachability](#reachability-is-the-real-guard).
4. **The generated C is a certification artifact, and that constrains the language.** Not
   only the formatter. This is why scope depth is bounded — see [#1307](https://github.com/jlaustill/c-next/issues/1307).
5. **An invariant without a gate does not count.** State it with its gate or do not state it.

---

## §1 — The three layers and eight passes

```
PARSE       1.1 Discover  ─→ SourceGraph
            1.2 Parse     ─→ ParsedFile     (per file)
            1.3 Declare   ─→ FileSymbols    (per file)   Tier 1
            1.4 Resolve   ─→ Program        (+ query surface)  Tier 2

TRANSPILE   2.1 Analyze   ─→ Diagnostics
            2.2 Plan      ─→ EmissionPlan   (decisions live here)
            2.3 Render    ─→ RenderedFile   (text only)

WRITE       3.1 Write     ─→ disk
```

### Ownership

| #   | Pass         | Owns — is sole author of                                                                                      | Emits          |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.1 | **Discover** | which files exist, their kind, the include graph, topological order, every resolved absolute path             | `SourceGraph`  |
| 1.2 | **Parse**    | syntax — AST, tokens, comments, parse errors                                                                  | `ParsedFile`   |
| 1.3 | **Declare**  | **identity and declaration** — every symbol a file declares                                                   | `FileSymbols`  |
| 1.4 | **Resolve**  | **every fact requiring more than one file**, and the query surface                                            | `Program`      |
| 2.1 | **Analyze**  | _is this program legal?_ — all diagnostics, codes, positions                                                  | `Diagnostics`  |
| 2.2 | **Plan**     | _what C should exist?_ — declarations and order, includes, helpers, MISRA annotations, toolchain requirements | `EmissionPlan` |
| 2.3 | **Render**   | text. Formatting only — **no decisions**                                                                      | `RenderedFile` |
| 3.1 | **Write**    | the filesystem, exclusively                                                                                   | side effects   |

### The rules that make ownership checkable

- After **1.1**, nothing may discover a file. Today `output/codegen/TypeValidator.ts:6`
  imports `existsSync`, and [#1137](https://github.com/jlaustill/c-next/issues/1137) is
  open on `CnxFileResolver` doing the same.
- After **1.2**, nothing may re-parse. Today every `.cnx` is parsed **twice**
  ([#1301](https://github.com/jlaustill/c-next/issues/1301)).
- After **1.3**, **nothing may compute a symbol's name.** This is #1285 stated as an
  architectural rule rather than a cleanup task.
- After **1.4**, nothing may compute a cross-file fact. Today auto-const is accumulated
  _while streaming_ through codegen, so the first file generates against an empty map.
- **2.1 authors every rejection.** A codegen `throw` carries no line, which is why 129 of
  282 `.expected.error` fixtures begin at `1:0`.
- **2.2 decides, 2.3 formats.** "Does this file need `<stdint.h>`?" is decided once, in
  the plan.
- **3.1 is the only importer of `node:fs`.** With one honest exception, below.

### `CodeGenState` dissolves

This is the test of whether the model is real. Its 36 maps have three destinations and
none of them is a shared blackboard:

| today                                                                                                  | destination             | why                                                         |
| ------------------------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------- |
| symbol data, type tracking, function/callback tracking, pass-by-value, opaque scope vars, const values | **1.4 `Program`**       | they are symbol facts                                       |
| toolchain requirements, include flags, overflow/division helpers, C++ mode, target capabilities        | **2.2 `EmissionPlan`**  | they are emission decisions                                 |
| current scope, current function, params, locals, indent level                                          | **2.3, as local state** | transient render position — never global                    |
| generator reference                                                                                    | **deleted**             | exists only so handlers can call back into the orchestrator |

`state/` stops being a layer because it stops existing.

### The one honest exception: a host port

"3.1 owns `node:fs`" is false by design, not by backlog. Declare and Resolve genuinely
need a scratch directory and a subprocess to preprocess C headers (#985 recovery), and a
diagnostic genuinely needs to stat the disk to say "no sibling `.cnx` exists".

Rather than ship a rule with permanent exemptions — the shape of every gate this project
has already filed as decoration — declare a **`HostPort`** (filesystem, subprocess,
environment) as a Tier 0 artifact authored once in 1.1. The rule then becomes enforceable:
the port is the only permitted route, and `node:fs` outside it is a violation.

---

## §2 — The symbol model

### Two axes, not one

A fact has two independent properties, and conflating them mis-files the AST:

|                                            | **short lifetime** — dies by 2.2               | **long lifetime** — travels to 3.1                         |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------- |
| **Tier 1** — computable with one file open | AST structure                                  | identity, kind, position, declared type, qualifiers        |
| **Tier 2** — needs more than one file      | symbol conflicts (consumed into `Diagnostics`) | `isConst`, opaque-vs-defined, `cppDetected`, pass-by-value |

- **Tier** decides which pass authors a fact, and whether it can be cached.
- **Lifetime** decides whether it may cross into the artifact the next layer holds.

The test for tier is mechanical: **could you compute it with only this file open?**

The AST is Tier 1 with a short lifetime. That resolves the ANTLR problem rather than
relocating it: pull a serializable `SourceSpan` out (Tier 1, long lifetime, four integers),
and the tree's inability to serialize is confined to a pass whose output is cheap to recompute.

**Pass 1.3 consumes `ParsedFile` and does not re-export it.** That single rule is what makes
the lifetime axis enforceable — the tree is not reachable from any artifact a downstream
pass holds, so `depcruise` is a backstop rather than the primary guard.

### What a symbol carries

Audited by walking every consumer of symbol-derived data back to the underlying fact
(`ICodeGenSymbols`' 24 collections, `CodeGenState`'s 36 maps, `SymbolTable`'s 11 indices,
`HeaderSymbolAdapter`, `parseWithSymbols`). Status column is as of `54084175`.

#### Tier 1 — authored in 1.3 Declare

| fact                                                                   | status today                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `kind`                                                                 | carried, then **erased** at the logic→output boundary                                                                          |
| `name` (leaf, as written)                                              | carried                                                                                                                        |
| `fullyQualifiedCName`                                                  | carried; 68 `QualifiedCName.join` sites still re-derive it                                                                     |
| `cnxScopedName`                                                        | carried; one consumer                                                                                                          |
| scope reference                                                        | carried — now `IScopeSymbol` after #1285 PR3                                                                                   |
| `sourceFile`, `sourceLine`                                             | carried                                                                                                                        |
| **`sourceColumn`**                                                     | **missing from every symbol type** — every non-symbol diagnostic has one                                                       |
| `sourceLanguage`                                                       | carried                                                                                                                        |
| **`visibility`**                                                       | **wrong for 4 of 7 kinds** — [#1300](https://github.com/jlaustill/c-next/issues/1300)                                          |
| declared type (`TType`)                                                | carried, flattened to a bare string at three boundaries                                                                        |
| array dimensions (as written)                                          | carried                                                                                                                        |
| `isConst` (as written), `isAtomic`, `isVolatile`                       | carried on variables; `isAtomic` dead on struct fields                                                                         |
| **`overflowBehavior`**                                                 | **missing** — [#1303](https://github.com/jlaustill/c-next/issues/1303)                                                         |
| `initialValue` (source text)                                           | carried                                                                                                                        |
| **members as symbols**                                                 | **missing** — `enum_member` / `bitmap_field` / `register_member` are declared in the kind vocabulary with no `TSymbol` variant |
| **member source position**                                             | **missing**                                                                                                                    |
| bitmap backing type / field offsets, register address / member offsets | carried, then shredded into six parallel string maps                                                                           |
| function parameters, return type                                       | carried, and independently re-collected in `output/`                                                                           |
| function body                                                          | carried as `unknown` — the main obstacle to a frozen artifact                                                                  |
| **is-a-callback-type (ADR-029)**                                       | **missing from symbols; authored in `output/`**                                                                                |

#### Tier 2 — authored in 1.4 Resolve

`isConst` (auto-const #268) · parameter-modified, direct and transitive · pass-by-value
eligibility · call graph · opaque-vs-defined · symbol conflicts · `cppDetected` · callback
promotion · which C header declares a type · transitively visible enums from includes ·
external const values · `externalStructFields` · resolved array dimensions.

> `isExported` is **not** a fact. It is `visibility`, minus ADR-030's `main` exemption,
> minus "a scope is a container, not a declaration". Those rules belong in `EmissionPlan`;
> `visibility` is the Tier 1 fact they are computed from.

### `resolveType` must return a symbol, never a string

`getTypeName()` is the exact point where `kind` dies. `Program.resolveType(name, fromScope)`
returns a **symbol reference**. That one change subsumes the five `known*` sets, makes
`isScopeType` a `kind` check rather than a name-namespace inversion, and makes
[#1281](https://github.com/jlaustill/c-next/issues/1281) and
[#1287](https://github.com/jlaustill/c-next/issues/1287) diagnosable.

`TTypeInfo`'s eight optional booleans (`isEnum?`, `isBitmap?`, `isString?`, `isAtomic?`,
`isPointer?`, …) are the fossil of re-encoding `kind` downstream. They can represent
contradictory states.

### A scope is a naming context — nothing else

Scopes are **not namespaces, not objects, not newable.** They take what OOP proved useful
for organization and leave the rest. A scope has no instances, never appears in a type
position, and is not a thing you can hold a value of. In the model it is an **entry in a
table that symbols point at**, not a live object graph they hang off.

A symbol carries its scope as a **path or id**, never as the directory object itself.
Today `scope: IScopeSymbol` is the real object, with mutable member arrays and a
self-parented root — which is why `JsonCodec` stack-overflows encoding it, why it cannot
be frozen, and why [#1301](https://github.com/jlaustill/c-next/issues/1301)'s duplicate
members are reachable from every symbol rather than from one table.

#### Depth is bounded by the target, not by the language

[ADR-016](../decisions/adr-016-scope.md):437 decides no nested scopes for v1. The
reason is pragmatic and has a hard edge: **C99 §5.2.4.1 guarantees only 31 significant
initial characters in an external identifier**, and MISRA C:2012 Rule 5.1 is evaluated
within that budget.

Measured with 6-character scope names:

| depth | generated name                           | length | distinct within 31? |
| ----- | ---------------------------------------- | ------ | ------------------- |
| 3     | `Scope1__Scope2__Scope3__weight`         | 30     | yes                 |
| 4     | `Scope1__Scope2__Scope3__Scope4__weight` | 38     | **no**              |

This is already violated at depth 1 — see [#1307](https://github.com/jlaustill/c-next/issues/1307).

So the bound is a property of the **C target**, not of the language:

- the **model** represents a scope path of arbitrary depth — cheap, and C++ interop needs
  it regardless, since namespaces genuinely nest (`NamespaceCollector.ts:35` already
  stores the full `Outer::Inner` path);
- a **rule in 2.1 Analyze** bounds it, with the threshold read from `ITargetCapabilities`;
- if C-Next ever becomes a compiler rather than a transpiler, you change a target
  capability, **not the model**.

### Four vocabularies for one concept

Before adding facts, the concepts need one spelling each. Measured: **four** kind
vocabularies, **nine** incompatible parameter representations, **three** struct-field
records. A base interface carrying every language's optional flags is how `TTypeInfo` got
its flag-bag; that is the bill for not deciding.

One model can hold C-Next, C and C++ symbols, sharing `kind`, `name`, identity,
`container`, position, `sourceLanguage`, `visibility` and `linkage` — where `linkage`
generalizes C-Next's `isExported`, C's `isExtern` and C/C++'s `isDeclaration`. But the
**declared type must not be shared as a string**: make it
`{ kind: "cnext", type: TType } | { kind: "passthrough", text: string }` so a consumer is
forced to handle both.

---

## Reachability is the real guard

`IBaseSymbol` is already fully `readonly`. TypeScript already stops the writes. What
nothing stops is the reads that reconstruct: 68 sites still call
`QualifiedCName.join(scope, name)` and mutate nothing.

| question                                            | mechanism                     |
| --------------------------------------------------- | ----------------------------- |
| Can this fact **change** after the boundary?        | `readonly` + deep freeze      |
| Can this fact be **recomputed** after the boundary? | **encapsulation + a CI gate** |

Two mechanism notes, both measured against the installed immer 11.1.4:

- `freeze(x, true)` is a **silent no-op on class instances** and does not recurse into one
  nested in a plain object. So "every artifact is deep-frozen" and "`Program` is a class
  with `#private` fields" cannot both hold. Artifacts are plain data with the query surface
  as functions over them, **or** the freeze needs a hand-rolled walk.
- Deep-freezing an ANTLR tree reaches the process-global ATN and breaks the _next_ parse.
  In a batch run that ends the run; in the long-lived `ServeCommand` it bricks the session.

---

## What is settled, and what is not

### Settled

Three layers, eight passes, the ownership table. The Tier × Lifetime axes. Scope as a
naming context carried by path. `resolveType` returns a symbol. `CodeGenState` dissolves.
Every invariant ships with its gate.

### Open — a follow-up session must decide these first

1. **The ADR band.** `0xx` commits v1 to completing this; `1xx` says the current pipeline
   ships v1. This also obliges a decision on ADR-053 (Implemented, describes the pipeline
   this supersedes) and ADR-065 (WIP, prescribes a decomposition this absorbs).
2. **Why the Tier boundary exists.** It was justified here by cacheability, and that
   justification does not survive measurement. Over 1,163 `.cnx` files from `tests/` and
   `examples/`, timed after a warm-up pass, Declare is the **cheapest** of the three passes
   measured:

   | pass        | share    |
   | ----------- | -------- |
   | Parse       | 15.2%    |
   | **Declare** | **2.0%** |
   | Analyze     | 82.8%    |

   So perfect Tier 1 caching removes about 2% of the work of these three passes, and less
   than that of the whole pipeline. There is also **no C-Next symbol cache today at all** —
   `CacheManager` filters C-Next symbols out explicitly, so `FileSymbols` caching is new
   capability, not a refactor of an existing one.

   Only the ratio is durable; absolute milliseconds vary by machine and warm-up, so they are
   deliberately not quoted. Analyze dominating at 82.8% is itself the more interesting
   finding, and it is not what this document is organized around.

   The boundary is probably still right — for order-independence, for making cross-file
   dependence visible in the type system, and for incremental rebuild in the LSP. But if the
   ADR justifies it by caching, it justifies it with the smallest number in the system.
   Rewrite the justification or move the boundary. Falsify by instrumenting
   `_executePipeline` on a real firmware project rather than this corpus, whose files average
   ~42 lines — the exact shape that could hide per-symbol and per-include cost.

3. **Is `EmissionPlan` per-file or per (file × mode)?** `cppMode` changes structural
   decisions, not just text, and C++ is the larger render target (823 `.expected.cpp` vs
   803 `.expected.c`). If structural, "Render owns nothing" needs restating. `cppMode` is
   also circular in 1.1 today: Discover resolves `.cnx` → `.h`/`.hpp`, which needs a fact
   Stage 2 discovers.
4. **Does Render really own nothing?** There are 177 `throw new Error` sites in `output/`
   versus 4 in `logic/`, and include effects are authored mid-render. Classify them before
   drawing the Plan/Render boundary.
5. **The interactive path.** `ServeCommand` holds one long-lived `Transpiler` and re-runs
   the whole pipeline per request at 8.5–11 ms warm. "Program is never cached" makes
   per-keystroke cost scale with project size. No latency budget is set, and there is no
   watch mode.
6. **The diagnostic migration.** 143 diagnostics with no error code, 129 fixtures at `1:0`, 177 throws
   to relocate. The update path **deletes** the `.expected.error` of a fixture that stops
   erroring, converting a lost diagnostic into a green suite. Guard first: assert the set
   of fixtures carrying an `.expected.error` never shrinks.

---

## Sequencing

Stages 1–6 already map onto the eight passes almost 1:1 — Stage 1→1.1, Stage 2/3→1.3,
Stage 3b/4→1.4, Stage 6→3.1. **The entire restructure is splitting Stage 5**, which is
documented as "generate code and its header (per-file, while that file's state is warm)"
— and that warmth is the exact reason `CodeGenState` exists.

A strangler order, cheapest and most independently valuable first:

1. **Fix the double parse** ([#1301](https://github.com/jlaustill/c-next/issues/1301)) so
   Stage 3 and Stage 5 share one tree and one resolve. Pure win, measurable, no new
   abstraction, and it makes resolution idempotent — a prerequisite for freezing anything.
2. **Close the gate holes** — [#1297](https://github.com/jlaustill/c-next/issues/1297)'s
   transitive rule, and an `ast-confined-to-parse` rule at `warn` with a known-violation
   count that can only go down.
3. **Hoist Analyze out of Stage 5** so every file is analyzed before any is planned. This
   forces the `Diagnostics` artifact and exposes every cross-file order dependency.
4. **Split header emission into Plan.** Stage 6 has already half-done this.
5. **Only then** introduce the owned IR.

A staged migration is a duplicate code path, which `CLAUDE.md` forbids without approval.
That approval should be requested **once, for a bounded and dated window, at the top of the
ADR** — not discovered at step 3.

---

## Defects this audit found

All verified with a reproduction that was actually run, against `968f28cc`–`54084175`.

| issue                                                                                                                                             | severity            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| [#1303](https://github.com/jlaustill/c-next/issues/1303) ADR-044 clamp silently dropped cross-file — local clamps to 255, imported wraps to 4     | silent miscompile   |
| [#1302](https://github.com/jlaustill/c-next/issues/1302) string equality generated as inequality when the literal contains `!=`                   | silent miscompile   |
| [#1307](https://github.com/jlaustill/c-next/issues/1307) two scope members collide within C99's 31 significant external characters (MISRA 5.1)    | standards violation |
| [#1300](https://github.com/jlaustill/c-next/issues/1300) `private` ignored for scope struct/enum/bitmap/register — emitted into the public header | ABI leak            |
| [#1301](https://github.com/jlaustill/c-next/issues/1301) every `.cnx` parsed and resolved twice; second resolve duplicates scope members          | correctness + waste |
| [#1306](https://github.com/jlaustill/c-next/issues/1306) no diagnostic for nested scopes; the fixture asserts raw ANTLR token lists               | missing diagnostic  |
| [#1297](https://github.com/jlaustill/c-next/issues/1297) depcruise reports layers clean while `logic/` reaches `output/` through `state/`         | gate is decoration  |
| [#1298](https://github.com/jlaustill/c-next/issues/1298) `getScopePath`'s cycle guard neither terminates nor throws on a proxy chain              | latent hang         |
| [#1296](https://github.com/jlaustill/c-next/issues/1296) `CLAUDE.md` documents adapters that do not exist                                         | stale docs          |

That #1303 and #1302 are both **cross-cutting rules that work in one position and fail in
another** is the argument for this document. Neither is an exotic edge case; both compile
clean, and both were invisible because the corpus tests the position that works.
