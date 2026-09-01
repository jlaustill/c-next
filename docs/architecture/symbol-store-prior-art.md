# How other compilers hold symbol facts

Prior art for the symbol layer, surveyed during the [#1431](https://github.com/jlaustill/c-next/issues/1431)
spike. Its companion, [`symbol-view-scopes.md`](symbol-view-scopes.md), records what C-Next's
own containers do and what the spike measured about them. This document records what everyone
else does, so the survey does not have to be run twice.

**Read this before proposing a database, a query engine, or a state-management library for the
symbol layer.** The instinct is a good one and the modelling is sound; the survey's conclusion
was that C-Next should adopt several of the _techniques_ and none of the _engines_, and the
reasons are specific enough to be worth keeping.

Everything below was read from a primary source or measured. The verified/unverified split is
at the end, and it is not decorative — several claims here rest on a single documentation
sentence.

## The one table worth keeping

Whatever is proposed next, this is the constraint it has to clear. The **same**
`logic/ → output/` coupling, expressed eight ways against this project's four layer rules
(`tsPreCompilationDeps: true`, `reachable: true`), one `depcruise` run:

| how the coupling is written                            | depcruise                          |
| ------------------------------------------------------ | ---------------------------------- |
| direct typed import                                    | **error**                          |
| free-function query imported from `output/`            | **error** (direct and transitive)  |
| provider table, layer-neutral result type              | silent                             |
| provider table, vocabulary laundered through `unknown` | silent — and `tsc --strict` exit 0 |
| SQL string                                             | silent                             |
| phase slice map naming the generate slice              | **error** (transitive)             |
| dynamic `import()` with a non-literal specifier        | silent — `tsc` exit 0              |

The rule is **the coupling must be a TypeScript import edge**. Not "no query strings" — a
provider table is fully typed, string-free and compiles clean, and the gate sees nothing.
Phrased correctly the rule rejects provider tables, dynamic imports and query strings alike,
and accepts queries written as ordinary imported functions.

`knip` is blinded the same way: in the same tree it reported the dead free-function query and
did **not** report the dead registered one.

## TypeScript

The most useful entry, because it is the only one that could be read from disk rather than from
documentation — `node_modules/typescript/lib/typescript.js`, 5.9.3.

**There is no relational store.** It is lazy memoized derivation over a mutable object graph,
and the facts split cleanly in two:

- **Stored / syntactic**, produced by the binder and hung on the tree: `SourceFile.locals`,
  `Symbol.exports`, `Symbol.members`, `Symbol.declarations`, `Symbol.flags`. The binder is
  idempotent-guarded by its own output — it binds only `if (!file.locals)`.
- **Derived / semantic** — types, resolved signatures, resolved symbols, the transitive export
  closure — is **never stored on the Symbol or Node**. It lives in `var symbolLinks = []` and
  `var nodeLinks = []`, two arrays inside the `createTypeChecker` closure, reachable only
  through `getSymbolLinks(symbol)` / `getNodeLinks(node)`. Ids are stamped lazily on first use.

Four properties are worth copying.

**The typed boundary is the `.d.ts`, and it is enforcement by omission.** `SourceFile.locals`
exists at runtime and is simply not declared; the public `Symbol` exposes seven of fourteen
runtime slots; `SymbolLinks`, `NodeLinks` and `CheckFlags` appear zero times in the shipped
`.d.ts`. Four attempted internal accesses fail under `--strict` with TS2339, while
`sym.flags & ts.SymbolFlags.Type` compiles. The same reads in plain JavaScript work fine. This
costs nothing at runtime and is earlier than any CI gate.

**Memoization is a per-slot policy, not a wrapper.** The canonical idiom re-checks the slot
after the worker returns, because the worker can recursively populate it, and writes
_conditionally_ — context-sensitive parameter types are deliberately not cached. Negative
results are cached too: a failed resolution stores an `unknownSymbol` sentinel so the walk and
its diagnostic run once per identifier.

**Cycles use an explicit resolution stack, never the memo.** On a real cycle every frame from
the cycle start is marked failed and the caller emits a circularity error _instead of memoizing
garbage_. That is exactly [#1433](https://github.com/jlaustill/c-next/issues/1433), where a
cycle-cut `false` is cached and a diagnostic then falsely rejects. The general rule — **never
memoize a value computed inside an unresolved cycle** — is worth more than the one-site fix.

**Visibility is not stored anywhere.** Resolution walks upward from the _use site_ through
`locals`, then `exports`, then `globals`, filtering every hit through a `meaning` bitmask. An
exported declaration produces **two symbols in two tables**, so "what a file can see" and "what
a file publishes" are physically different tables rather than one table with a flag. C-Next's
`knownEnums` / `knownStructs` / `knownBitmaps` are the opposite shape: one table whose
membership implies both existence and kind.

`SymbolFlags` is the alternative to parallel sets, and it does something parallel sets cannot:
the `Value` and `Type` composites **deliberately overlap** on classes, enums and enum members,
so one symbol legitimately answers both a value query and a type query.

**Cost shape.** `tsc --noEmit --extendedDiagnostics` on this repo: 1107 files, bind 0.25s,
check 2.46s, total 3.35s — and **523,596 symbols producing only 148,496 types**. About 72% of
symbols never have the expensive fact derived at all. That is the structural answer to a
whole-corpus derive cost: lazy per-question memoization turns a _pass_ cost into a
_per-question_ cost most questions never pay. It never evicts; 586 MB is the right trade for a
process that exits.

One tension for the frozen-artifact target: TypeScript has **zero `Object.freeze` calls** in
9.1 MB, and its memo tables key on ids stamped onto nodes by mutation on first use. Freezing
forbids the stamping. Either assign ids before freezing, or key by `WeakMap`.

## Demand-driven query engines — rustc, Salsa, rust-analyzer

A query is declared, becomes a method on a context, and dispatches to a provider that the
rustc dev guide requires to be "a pure function in the sense that for the same key it must
always yield the same result." Salsa generalizes it: inputs for mutable roots, tracked
functions for memoized derivations, red-green invalidation with revision counters, and
backdating so a re-execution producing an equal value keeps downstream green.

**Purity is the part worth wanting.** An order-dependent diagnostic and a read of the previous
file's registry are not expressible when "populated later" has no meaning — a query either
computes on demand or does not exist. That argument is independent of caching and performance.

**The incremental half is overhead for a batch run.** The dev guide says outright that
"computing fingerprints is quite costly. It is the main reason why incremental compilation can
be slower than non-incremental compilation." Fingerprints, dep nodes, revisions, red-green and
an on-disk cache all pay off at revision 2, and a single-pass batch transpiler has no revision 2.

There is **no npm Salsa**, so this is a build rather than a buy — and the batch-only subset of
it (free functions, one `Map` per query, an in-flight key stack for cycles, no dep graph) is not
meaningfully different from what plain TypeScript already gives.

**Cycle policy differs, and TypeScript's is the right model for a transpiler.** rustc aborts
with a cycle error; Salsa panics naming the cycle head unless fixpoint recovery is opted into.
A transpiler must emit a diagnostic with a code and a position, not panic.

## Code as a database — CodeQL, Glean, Kythe, Datalog

All four normalize code to facts and query declaratively, so the modelling instinct behind
#1431 is vindicated by the family. None is an engine to run here.

**They are built for a different question.** These exist so that facts about millions of lines
_across repositories_ need not be re-derived, and so that consumers nobody anticipated can ask
questions later. Glean is an out-of-process server managing databases on disk, write-once then
query-later, serving many clients. C-Next is a single batch process with no external consumers.
No production compiler was found using any of them as the primary in-process store for its own
passes.

**Their query languages are typed, which corrects a common overgeneralization.** "Query strings
are untyped" is true of SQL and of Kythe — whose storage documentation says values are
"uninterpreted bytes" and that it "does not include a schema for its contents". It is **false**
of CodeQL's QL, Glean's Angle and Soufflé, all of which typecheck queries against a declared
schema; Glean additionally compiles its schema to Thrift so the host language sees native types.
The family is ruled out on gate visibility, not on typing.

**Cost is disqualifying regardless.** CodeQL wants tens of gigabytes of disk; Glean is
Haskell + GHC + RocksDB + Thrift behind a server; Kythe is Bazel extraction plus a datastore
plus a pipeline plus a server; Soufflé embeds only through generated C++, i.e. a native addon.
Each is a _larger_ foreign-toolchain cost than the native SQLite build already declined.

## Flux, Redux, and selectors

**The pattern maps well; the library does not.** One frozen fact set, passes as reducers,
derived views as memoized selectors — selectors are ordinary typed functions, so they satisfy
both the typing and the gate constraints for the same reason an imported query function does.
`immer` is already a dependency and already ships `freeze`, `Immutable<T>` and `Draft<T>`.

**Two details are load-bearing and easy to get wrong.**

The common claim that "reselect's cache size is 1" is true of `lruMemoize` and **false** of
`createSelector` in v5, which uses `weakMapMemoize` — a WeakMap/Map trie keyed on argument
identity, effectively unbounded. Measured: 15 recomputes (ideal) with the default versus 45–60
with `lruMemoize` at size 1; 19.9 ns per lookup versus 253 ns over 500 rotating keys. The
"many distinct keys" worry is answered by the v5 default **provided the frozen per-file
artifact is argument 0**, so its memo subtree becomes collectable when the artifact is replaced.
A primitive leading argument lands in an unbounded `Map` that grows across every file.

**Redux the library actively contradicts phase separation.** `combineReducers` calls
`assertReducerShape`, which requires every slice to return a defined state at INIT — so a Redux
store's _type_ has every phase present from t=0, which is precisely the shape that permits an
analyzer to read state a later pass populates. The reducer signature is also the wrong joint: a
reducer is `(state, action) => state`, same type in and out, while a compiler pass is
`(artifactN) => artifactN+1` with a different type each time.

One rule from Redux Toolkit is worth keeping without the package: identity-memoized selectors
return stale results when handed a draft, so **never run a selector against a draft, only
against a finished frozen artifact.**

## Phase-typed intermediate representations

**GHC's "Trees That Grow"** is the real precedent: a `Pass` kind, a GADT indexed by it, and a
type family mapping each pass to its identifier type. Practitioners report needing conversion
boilerplate between passes even when the representation is identical, with `unsafeCoerce`
offered as the pragmatic workaround — the ceremony cost is documented by users, not theorized.

**rustc's MIR phases are the instructive counterexample.** `MirPhase` is a plain runtime enum;
the docs say phases "exist only to place restrictions on what language constructs are permitted
in well-formed MIR" and describe no type-level enforcement. rustc gets its real phase separation
by making HIR, THIR and MIR **distinct types**. That is the cheap version of the same idea, and
it is the one to copy.

In TypeScript the encoding is small — a slice map plus an intersection over the slices a pass is
given — and it turns "an analyzer read state a later pass populates" into a compile error.
The catch is that phase types only constrain what is **passed**: an analyzer reaching a
module-global is unaffected, and there are 884 such references across 70 files. Phase types over
a codebase that still reaches a global are decorative. Delete the global first; the types are
what stop it growing back.

Slice types must live in **separate modules** — a slice map that merely _names_ a later phase's
slice creates a transitive import edge, so `depcruise` enforces the split rather than review
having to catch it.

## Ideas worth stealing without the engines

- **Glean's `stored` versus on-demand derived predicates.** The materialization decision made
  declaratively per view, in one keyword: `stored` is computed once by an explicit pass,
  everything else at query time. That is the right vocabulary for "materialize the include
  closure, derive the cheap per-file views".
- **Kythe's verifier shape.** Source annotated with goals describing entries the verifier must
  _and must not_ find. Must-find plus must-not-find is the negative-control discipline
  `CLAUDE.md` already requires of error fixtures, applied to the symbol layer.
- **TypeScript's enforcement by omission.** The cheapest bypass prevention available, at zero
  runtime cost.
- **rustc's distinct IR types.** Phase separation without type-level machinery.

## Verified

Read from a primary source on disk, or measured on this machine:

- The eight-variant `depcruise` matrix, dependency-cruiser 17.3.7, in a standalone tree
  mirroring `src/transpiler/` with this repo's four layer rules copied verbatim. Variant C2
  additionally `tsc --strict` exit 0.
- The TypeScript boundary probe: 4/4 internal accesses TS2339, 2/2 public accesses compile.
- `tsc --noEmit --extendedDiagnostics` on this repo: 1107 files, 523,596 symbols, 148,496 types,
  3.35s total, 586 MB.
- TypeScript source read directly (`typescript.js` 5.9.3): the links arrays and accessors, the
  memo idiom, the cycle stack, the export-symbol split, the resolution walk. `Object.freeze`
  count in 9.1 MB: **0**.
- reselect 5.3.0 source and its zero dependencies; `redux`'s `assertReducerShape` read directly;
  Redux Toolkit's dependency list from the registry.
- Selector benchmarks on Node 24: the recompute counts and nanosecond figures quoted above.
- The phase-type experiments, compiled with this repo's own `tsc`.
- Kythe's `storage.proto` and storage documentation, and SQLite's statement that views are
  read-only, fetched directly. GHC's `Pass.hs` and `Extension.hs` read directly.
- A hypothetical rule forbidding `logic/analysis/` from reaching `state/CodeGenState.ts`, run
  against live `src/`: **26 violations across 15 non-test source modules**, several only
  transitively.

## Not verified

Treat these as leads, not findings:

- **rustc's source.** Every fetch 404'd. The provider-table description rests on the dev guide's
  own prose. The gate-visibility property it illustrates was measured independently and does not
  depend on rustc being the reason for it.
- **jscpd against the duplicated provider interface** — not installed; the thresholds were read
  from config, not measured.
- **WeakMap-keyed versus id-array-keyed side tables** are not benchmarked. This is the open
  question if the frozen-artifact target forbids id stamping.
- **immer's auto-freeze cost** across a full corpus is unmeasured, and `enableMapSet()` is in
  play.
- **Whether TypeScript gates its own internals** against raw slot access — none was found in the
  shipped artifact, and their build config was not fetched. "Enforcement is the `.d.ts`" is
  verified for _consumers_, unverified for TypeScript's own source.
- **"No npm Salsa"** and "no production TypeScript compiler phase-indexes its IR" are bounded
  negative searches, not proofs.
- **Whether the language server has latency requirements today.** Everything here assumes
  single-pass batch. If it does not hold, the cost calculus for the query-engine family changes
  substantially — settle this before locking in any batch-only simplification.
