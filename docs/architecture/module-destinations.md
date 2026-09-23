# Module destinations

Where each module under `src/` lives once `src/` is the pass table
([`README.md` §1](README.md)), and why.

This document is **#1443's deliverable 1**, started here by #1472/#1447 because a
pass card cannot move its own modules without saying where they go. It is
incomplete on purpose: it holds the modules moved so far, plus the ones whose
destination is known and whose move is blocked. #1443 completes it, and the
remaining seven pass cards add their rows the same way.

## The rule

A module belongs to **1.3 Declare** when everything it computes is computable
with one file's parse tree open, and to **1.4 Resolve** when it needs more than
one file.

That is not a new rule invented for this document — it is the admission rule
already authored on `IFileSymbols`, applied to modules instead of fields. Using
the same test in both places is the point: a second rule would be a second thing
to keep in step.

### The rule above is about PARSE, and it is two-way

It answers "1.3 or 1.4", so it has no answer for a module in neither. That is
not a gap to paper over with judgement — a rule that cannot express the move
being made is how the wrong row gets written and then defended, which is
exactly what happened to `PublicInterface.ts` below.

For the TRANSPILE passes the test is **what the module decides**, because that
is what §1 assigns them by:

- **2.1 Analyze** — whether the program is legal. Emits diagnostics.
- **2.2 Plan** — what C should exist. Emits decisions: includes, helpers,
  declarations and order, MISRA annotations, toolchain requirements.
- **2.3 Render** — what the text looks like. Decides nothing.

The discriminator between 2.2 and 2.3 is whether removing the module would
change _what_ is emitted or only _how it reads_. A module that answers "does
this file need `<stdint.h>`?" is 2.2 even if it also prints the line; a module
that cannot answer any such question is 2.3.

A module named by more than one LAYER belongs to neither and is a shared
contract: `.dependency-cruiser.cjs` sends those to `transpiler/types/`, which
every layer may depend on.

## `awaiting` is a real destination

A row reading `awaiting #NNNN` means the destination is decided and the move is
not yet possible. That shape is deliberate ([#1313 correction 3](https://github.com/jlaustill/c-next/issues/1313)):
the map has to be able to land before every module can be placed, or it waits on
all nine pass cards and blocks them in turn. It is ratcheted — a row may move
from `awaiting` to a real path, never back.

## PARSE

### 1.2 Parse — `src/PARSE/2-Parse/`

Moved as a tree (#1445 box 4, absorbing this card's 1.2 Parse rows and move at
the maintainer's direction). `src/transpiler/logic/parser/` no longer exists.

| module                           | why                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `CNextSourceParser.ts`           | the pass itself: source text becomes one `IParsedFile`, once                                              |
| `CommentScanner.ts`              | reads comments off the hidden channel of that parse; a fact about the parse, not about a pass above it    |
| `HeaderParser.ts`                | the same for a C or C++ header                                                                            |
| `grammar/**`                     | ANTLR's output for `grammar/CNext.g4` — the tree 1.2 produces, so it lives with the pass that produces it |
| `c/grammar/**`, `cpp/grammar/**` | the same for the C and C++ grammars                                                                       |

Two things this move needed that no previous pass move did, recorded so the next
tree-move does not rediscover them:

- **12 non-TypeScript files.** `.interp` and `.tokens` are ANTLR byproducts,
  tracked in git and read by nothing in the repo. `ts-morph` does not know about
  them, so `npm run move:modules` reports them as `not in the project` and exits
  non-zero; they move by `git mv` alongside.
- **The `antlr*` scripts' `-o` paths.** Five scripts in `package.json` write into
  this directory. Had they not moved with it, the next `npm run antlr:all` would
  have silently recreated the old tree beside the new one.

### 1.3 Declare — `src/PARSE/3-Declare/`

| module                                 | why                                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cnext/index.ts`                       | `CNextResolver`: collects what ONE C-Next file declares                                                                                                                                   |
| `cnext/collectors/**`                  | each takes a single parse tree                                                                                                                                                            |
| `cnext/utils/**`                       | type and expression helpers used while collecting one file                                                                                                                                |
| `cnext/types/**`                       | the collectors' own result shape                                                                                                                                                          |
| `cnext/adapters/TSymbolInfoAdapter.ts` | **resolved** — `convert()` stays in 1.3; `mergeOpaqueTypes` deleted (the fact is `Program`'s, so there was nothing to merge); the visibility composition moved to 1.4 as `VisibleSymbols` | Was blocked on `ICodeGenSymbols` no longer being the per-file view codegen reads. It is not one now: 1.4 composes each file's VISIBLE view once, at build, and codegen reads that. The composition used to run per file while rendering, over a map the publish loop was still filling — #1301 is that bug (#1511) |
| `c/**`, `cpp/**`                       | collect what one C or C++ header declares                                                                                                                                                 |
| `shared/**`                            | parameter extraction shared by the C and C++ collectors                                                                                                                                   |
| `TypeBinding.ts`                       | the one ladder from a type context to a name; reads the tree and an injected predicate                                                                                                    |
| `TYPE_FORMING_KINDS.ts`                | which kinds introduce a type name — a constant                                                                                                                                            |
| `SymbolUtils.ts`                       | helpers for the C and C++ collectors, per declaration                                                                                                                                     |
| `NameExistence.ts`                     | asks the PER-FILE view whether a name exists; its own header states that split                                                                                                            |

### 1.4 Resolve — `src/PARSE/4-Resolve/`

| module                       | why                                                               |
| ---------------------------- | ----------------------------------------------------------------- |
| `Program.ts`                 | the artifact 1.4 emits                                            |
| `DeferredTypes.ts`           | settles bare names against the whole-program scope-type set       |
| `TransitiveEnumCollector.ts` | walks the include graph, so it needs the graph rather than a file |

## TRANSPILE

### 2.2 Plan — `src/TRANSPILE/2-Plan/`

| module                        | why                                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmissionPlan.ts`             | decides what C should exist for one file — the artifact 2.2 emits                                                                                                           |
| `ComplianceAnnotations.ts`    | which safety-standard rule shaped a construct, and the one rendering of the house form                                                                                      |
| `HeaderTypeNames.ts`          | every type name a file's public header will name — one enumeration, where two derivations each stopped at functions and variables (#1520)                                   |
| `PublicInterface.ts`          | which symbols form a file's public C interface — `isExported` minus ADR-030's `main` exemption minus "a scope is a container", which §2 assigns to `EmissionPlan`           |
| `StringLengthCounter.ts`      | which `.char_count` reads are worth hoisting into a cached `strlen` temp — a choice about what C exists, not how it reads (#1445 box 3)                                     |
| `ExpressionTypeResolver.ts`   | the essential type of an expression — returns type names, never C text, and originates no diagnostic (#1445 box 3)                                                          |
| `AssignmentContextBuilder.ts` | turns an assignment statement into the `IAssignmentContext` that `AssignmentClassifier` decides the kind from — the input half of a decision 2.2 already owns (#1445 box 3) |
| `TypeRegistrationEngine.ts`   | walks declarations and writes the type facts every later decision reads — returns no text, so it fails the render admission test (#1445 box 3)                              |
| `TypeRegistrationUtils.ts`    | the engine's write half; registers an enum- or bitmap-typed variable from the one `DeclaredTypeFacts` derivation (#1651)                                                    |
| `dimensionEvalOptions.ts`     | the const-evaluation options both array-dimension paths must share, so the two cannot diverge on what folds                                                                 |

`EmissionPlan`, `ComplianceAnnotations` and `HeaderTypeNames` were created here
rather than moved: 2.2 Plan did not exist as a module anywhere, so for those
there was nothing to relocate. That sentence used to cover the whole section and
no longer does — `scripts/move-modules.ts` has since relocated ten modules into
`2-Plan/`, `PublicInterface` and `StringLengthCounter` among them.

**This table is incomplete, and deliberately says so rather than reading as
complete.** It documents 10 of the 22 modules under `2-Plan/`; eight modules the
manifest moved in have no row. Tracked as #1653 — each needs its own researched
_why_, which is not something to bulk-generate from the manifest's `because`
strings, since those argue the move and this column states the responsibility.

#1323's `HeaderRenderer` (`HeaderEmissionPlanner` until #1449) is **not** listed
— it renders header text from already-decided facts, which is 2.3 by the
discriminator above.

## Not a pass — `src/TRANSPILE/`

| module             | why                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CodeGenWalker.ts` | walks one file's parse tree and drives 2.2 and 2.3 over it — the role `Transpiler` plays for a whole run, which is why `src/transpiler/` already holds three tree-walking modules (#1445 box 3) |

It is not in `2-Plan/`, and that is a constraint rather than a preference:
`plan-cannot-import-render` is `error` with `reachable: true`, and the walk
imports sixteen generator functions and twenty-eight helpers from `3-Render/`.
Every other pass directory forbids the same edge, so a walker that calls
renderers cannot live in one. Putting it a level up says what is true — it
sits above the passes and drives them.

The split is **acyclic**, and that was measured rather than assumed: the half
that stayed in `3-Render/` makes zero calls back into the walk, so
`CodeGenWalker` depends on `CodeGenerator` and never the reverse. Fourteen of
`CodeGenerator`'s methods are reached through the injected host.

## Layer-neutral — `src/utils/`

Not a pass, so these have no section above. The map is keyed on passes, which
left modules moved _out_ of a pass and into `src/utils/` with nowhere to be
recorded — three had moved there with no row anywhere.

| module                             | why                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QualifiedNameGenerator.ts`        | builds a qualified C name from a scope path; imports only `SymbolRegistry` and `ScopeUtils`, and `2-Plan/` needs it too, which `plan-cannot-import-render` forbade while it sat in render (#1445 box 3) |
| `ast/AssignmentTargetExtractor.ts` | a generic parse-tree walker two passes reach (#1322)                                                                                                                                                    |
| `ast/ChildStatementCollector.ts`   | answers _what statements are inside this one?_ — a question about the tree, not about legality (#1322)                                                                                                  |

A module arrives here when more than one pass reaches it and it decides nothing
about the program — the admission test §1 states, answered "neither pass owns
this".

## Blocked

| module                                 | destination                                                                                                                                                                                            | blocked on                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cnext/adapters/TSymbolInfoAdapter.ts` | **split, half done** — `convert()` stays in 1.3; `mergeOpaqueTypes` is gone (#1511: the fact is `Program`'s, so there is nothing to merge in); `mergeExternalSymbols` is cross-file and belongs in 1.4 | the remaining half is still only reachable once `ICodeGenSymbols` stops being the per-file view codegen reads — it merges eighteen collections, of which #1511's twelve facts are a part |

That is the measurement behind "the pass split is not finished".
`src/transpiler/logic/symbols/` no longer exists: #1511 moved `SymbolTable.ts`
out of it, and #1452 moved it again — see below.

## 1.3 Declare — the symbol artifacts (#1452 box 1)

`src/transpiler/state/` is being removed, so the two modules it held that are
not render state needed a destination that is not "state".

| module              | destination                             | why                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SymbolRegistry.ts` | `src/PARSE/3-Declare/SymbolRegistry.ts` | The scope graph, and 1.3 Declare authors it. Every `getOrCreateScope` caller now sits under `3-Declare/`; two did not, and turned a name-to-path lookup into a scope creation in 2.1 Analyze and 2.2 Plan. `SymbolRegistry.scopePathOf` is that read, and `passes-hold-no-mutable-state.test.ts` keeps creation where it belongs. An instance since #1452 box 3, so this is a relocation with no mutable static to carry into a pass root. |
| `SymbolTable.ts`    | `src/PARSE/3-Declare/SymbolTable.ts`    | **Reverses the destination #1511 recorded.** See below.                                                                                                                                                                                                                                                                                                                                                                                    |

## Instrumentation — facts about the run (#1452)

`docs/architecture/README.md` admits `src/instrumentation/` as a fourth kind of
root beside the layers, the shared contracts and the host. A module belongs here
when what it accumulates is an OBSERVATION of the run rather than a fact the run
computes — nothing downstream branches on it — and it is the one root that may
hold mutable state.

| module                         | destination                                    | why                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state/AdrProvenance.ts`       | `src/instrumentation/AdrProvenance.ts`         | Records where an ADR's rule fired, so matrix occupancy can derive from codegen decisions and not only from diagnostic positions. A plain sink that classifies nothing. It is genuinely cross-pass — 17 `record` sites across 2.1 Analyze and 2.3 Render, read once at the end — so it does **not** satisfy #1452 box 4, and the owner's call on 2026-09-23 was that box 4 governs PROGRAM state, which a fact about the run is not. The exemption is stated, not incidental. |
| `state/CodeGenState.ts` (part) | `src/instrumentation/ToolchainRequirements.ts` | #1143's requirement accumulator: two maps and four methods, extracted rather than moved whole. It claims **no** part of box 4's exemption, because it is not cross-pass — every write is inside 2.3 Render and every read is in the same `generate()` call for the same file. The module docblock carries that table so the claim is re-measurable.                                                                                                                          |

`instrumentation-cannot-import-a-layer` (`reachable: true`) stops this root
reaching back into what it reports on. Mutation-checked: an import of a
1-Analyze module produces twelve violations.

## Deleted rather than re-homed (#1452)

Not every module in `state/` needed a destination. The architecture rule is that
_a fact lives in the artifact of the pass that authored it_, and for these the
artifact already existed — so the container was the only thing that had to go.

| module                             | outcome                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state/TranspilerState.ts`         | **Deleted.** Its four discovery facts moved onto `IProgram`, the artifact 1.4 Resolve authors, which every later pass may already depend on as a type. Two further fields left first: one dead, and two methods with only test callers.                                                                                                                                                                          |
| `SymbolTable.clear()`              | **Deleted, not extended** — #1177, and #1452 box 5. A teardown maintained by hand is the duplicate-decision shape this epic removes. It had already drifted: `externalDeclarationNames` was uncleared, it gates `hasExternalDeclaration`, that suppresses a diagnostic, and `ServeCommand` holds a `private static transpiler` — so the drift was reachable in the long-lived process rather than merely latent. |
| `CodeGenState`'s modification trio | **Deleted.** 2.2 Plan filled three statics, `ModificationFacts.derive` snapshotted them onto `IProgram`, and 2.3 Render then cleared and re-seeded them from that same artifact. The authoritative copy was always `IProgram`'s; the statics were scratch space two passes shared by accident of being global. The collection is now the call's own object (`IModificationCollector`).                           |

### Why `SymbolTable` moved again

#1511 placed it in `state/` with maintainer approval, on this reasoning:

> The admission rule places a module in the pass that computes its fact, and
> this computes none: it ACCUMULATES, filled from C/C++ headers in Stage 2 and
> read by every later pass. That is what `state/` holds.

The half of that which still stands is the part about `4-Resolve/`: it is
genuinely unreachable, because `nothing-after-resolve-derives-cross-file-facts`
forbids any pass after 1.4 from importing it, and **34** modules under
`TRANSPILE/` read the table. That rule names `4-Resolve/` specifically, and
`3-Declare/` is already imported from `TRANSPILE/`, so the edge that blocked the
one destination does not exist for this one. Confirmed rather than assumed:
`npm run depcruise` reports **0 errors** after the move, with no violation
naming either module.

The half that does not stand is _"it computes none: it ACCUMULATES"_. That is a
property of how the table is USED, and the admission test asks what a module
computes and with how many files open. Every write is one file's declarations —
four collectors under `3-Declare/`, plus five sites in the orchestrator that
drives them per file (`_publishResolvedFile`, `_collectExternalDeclarations`,
`restoreCachedSymbols`, `parsePureCHeader`, `parseCppHeader`). Each is
computable with one parse tree open. The accumulation across files is
`Transpiler`'s loop, not the table's doing.

Recording this here because #1511's row was right to demand maintainer approval
for changing a decided destination, and the owner's direction on #1452 is that
`src/transpiler/state/` goes away — which retires the destination rather than
the reasoning behind it.

## Placed, but with no rows here

**2.1 Analyze is relocated and undocumented.** `src/TRANSPILE/1-Analyze/` holds
**127** non-test modules, moved out of `src/transpiler/logic/analysis/` — which
no longer exists — beginning with `6e46f6d4` (#1322), 76 files in that commit
alone. They arrived as renames, not as new modules, so the "created here rather
than moved" exemption 2.2 Plan carries does not apply to them.

This document says it "holds the modules moved so far", and _"a pass card adds
entries there and rows here"_. Those rows were never added, and the pass sat in
the list below — grouped with passes that have not moved at all, which reads as
"nothing to place" rather than "placed, unrecorded". The rows themselves are
#1443's deliverable, not this correction's: what is fixed here is the claim,
so the gap is visible to whoever completes the map (#1450).

## 2.3 Render — moved as a tree (#1450 box 5)

`src/transpiler/output/` **is** the render pass: codegen and header generation,
**144** non-test modules (251 files with their tests). It moved whole to
`src/TRANSPILE/3-Render/`, the way 2.1 Analyze did, rather than file by file.

The manifest entry in `scripts/move-modules.ts` carries the reason; the short
form is that the admission test places a module in the pass that computes what
it holds, and every module here exists to turn settled decisions into text.

That reasoning named `CodeGenerator` as "the pass's own entry point", and
**#1445 box 3 found it was not one.** Of its 258 members, 193 named a parse
type or were reached only by members that did -- it was a tree WALKER that
called renderers, not a renderer. Those 193 moved to
`src/TRANSPILE/CodeGenWalker.ts` (below) and the 65 that stayed are the render
pass's service surface: `IOrchestrator`, the emission-fact capture, output
assembly. The render pass's entry point is now the walker calling into it from
outside.

**No module here exposes a classification predicate** — the count was 27 of 144
when the tree moved, and the difference is box 4: the decisions relocated to
`2-Plan/` and the modules went with them.

The property is stated without a present-tense denominator on purpose. It used
to read "zero of the 131", and 131 was ungated prose that nothing asserted:
`render-decides-nothing.test.ts` gates the **property**, never the population
size, so the number could only ever drift. It had — the tree held 156 non-test
modules when this was corrected, off in the _opposite_ direction from the moves
that prompted the check, because modules were added faster than #1445 box 3
moved them out. `find src/TRANSPILE/3-Render -name '*.ts' ! -path '*__tests__*'
! -name '*.test.ts' | wc -l` answers it in one line, which is why no sentence
here should. The discriminator §1 states — "would
removing the module change _what_ is emitted or only _how it reads_" — is what
sorted them, phase by phase within 2.x, since a module that decides is in the
wrong pass-_phase_, not the wrong pass, and this map keys destinations on the
pass.

Five modules still raise an emission fact (`requireInclude`, `requireToolchain`,
a `needs*` write), and that is **by design, not residue**. `IEmissionFacts` puts
it plainly: the questions "are what the generators accumulate _while producing
text_". A renderer discovering it has emitted a `strncpy` and therefore needs
`<string.h>` is not deciding anything — 2.2 Plan answers the question, and the
two captures that freeze it are the only places a `needs*` flag may be read.
That property, and the two below, are gated by
`scripts/__tests__/render-decides-nothing.test.ts`:

- no module under `3-Render/` **declares** a decision predicate — a `needs`,
  `requires`, `shouldBe` or `mustBe` name. Reddened by declaring one; a `is*`
  fact in the same position stays green, so the check distinguishes the two
  rather than flagging every boolean method.

  The first spelling of that check required a literal `static ` or `function `
  before the verb, and so **reported zero while three existed** — private
  instance methods on `CodeGenerator`, one of them (`_needsParamMemberConversion`)
  a bare delegate to the `CppMemberHelper` predicate this card had just moved to
  2.2 Plan. The zero above was published from that count before the #1589 review
  corrected it. Its own selector guard could not catch the error, because it
  filters to 2.2 Plan, which is static-class style by convention: it proved the
  regex worked on a population shaped differently from the one being asserted
  over. **A non-empty selector is not a correct selector** — match the
  declaration, not the keyword in front of it.

- every decision `2-Plan/` owns is consulted from the exact render modules that
  act on it, pinned per module rather than counted — a count survives the
  regression, because a second importer keeps it non-zero.

The honest limit: a brand-new decision **inlined** in a render module, under no
decision-shaped name and displacing no existing import, is caught by neither
shape. Both guards are name- or import-keyed, and an anonymous expression is
the case they cannot see.

What the move had to carry with it, recorded because none of it is obvious from
the diff: seven `.dependency-cruiser.cjs` rules keyed on the old path (a move
without them prints "no dependency violations found" while the layer is
unguarded — #1297's failure), `ParseTreeSites`' layer list and its render-layer
lookup, the throw-citation scanner's root, `ScopeJoinSites`' recorded sites, and
five test guards that named the path. `vi.mock()` specifiers and inline
`import("…")` types are string literals, so ts-morph rewrote neither.

## Not yet placed

The other two passes (1.1 Discover, 3.1 Write) have no rows here, and neither do
the 60 genuinely-shared modules or `cli/`, `lib/` and `index.ts` — §1's tree
names no home for the last group, which is
[#1466](https://github.com/jlaustill/c-next/issues/1466).

1.2 Parse was in this list and is now placed above (#1445).

## Moving modules

`npm run move:modules` dry-runs the move described by the manifest in
`scripts/move-modules.ts`; `-- --apply` performs it. The manifest carries the
reason for each destination, so this document and the move stay one decision
rather than two. A pass card adds entries there and rows here.
