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

| module                     | why                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmissionPlan.ts`          | decides what C should exist for one file — the artifact 2.2 emits                                                                                                 |
| `ComplianceAnnotations.ts` | which safety-standard rule shaped a construct, and the one rendering of the house form                                                                            |
| `HeaderTypeNames.ts`       | every type name a file's public header will name — one enumeration, where two derivations each stopped at functions and variables (#1520)                         |
| `PublicInterface.ts`       | which symbols form a file's public C interface — `isExported` minus ADR-030's `main` exemption minus "a scope is a container", which §2 assigns to `EmissionPlan` |

Created here rather than moved: 2.2 Plan did not exist as a module anywhere, so
there was nothing to relocate. #1323's `HeaderRenderer` (`HeaderEmissionPlanner` until #1449) is **not** listed
— it renders header text from already-decided facts, which is 2.3 by the
discriminator above.

## Blocked

| module                                 | destination                                                                                                                                                                                            | blocked on                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logic/symbols/SymbolTable.ts`         | `src/transpiler/state/SymbolTable.ts`                                                                                                                                                                  | **Destination changed, with maintainer approval.** `awaiting 1.4 Resolve` was unreachable, not merely waiting: `output/` (6 modules) and `TRANSPILE/` (7) import the table, and `nothing-after-resolve-derives-cross-file-facts` forbids either from reaching `4-Resolve/` transitively. No interface answers that — the rule is about the destination. `state/` is where it belongs on its own terms: it is a mutable accumulator filled during Stage 2 and read by every later pass, which is what `state/` holds, and the only rule constraining it (`state-cannot-import-output`) it already satisfied. 1.3 Declare already imports `state/`, so the edge that blocked 4-Resolve does not exist here (#1511) |
| `cnext/adapters/TSymbolInfoAdapter.ts` | **split, half done** — `convert()` stays in 1.3; `mergeOpaqueTypes` is gone (#1511: the fact is `Program`'s, so there is nothing to merge in); `mergeExternalSymbols` is cross-file and belongs in 1.4 | the remaining half is still only reachable once `ICodeGenSymbols` stops being the per-file view codegen reads — it merges eighteen collections, of which #1511's twelve facts are a part                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Those are the measurement behind "the pass split is not finished", and they are
why `src/transpiler/logic/symbols/` still exists — holding `SymbolTable.ts`
alone, since #1515 removed the edge that pinned `PublicInterface` there.

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
it holds, every module here exists to turn settled decisions into text, and a
partial move would leave `3-Render/` holding everything except the pass's own
entry point (`CodeGenerator`).

**Zero of the 131 now expose a classification predicate** — the count was 27 of
144 when the tree moved, and the difference is box 4: the decisions relocated to
`2-Plan/` and the modules went with them. The discriminator §1 states — "would
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

The other three passes (1.1 Discover, 1.2 Parse, 3.1 Write) have no rows here,
and neither do the 60 genuinely-shared modules or `cli/`, `lib/` and `index.ts`
— §1's tree names no home for the last group, which is
[#1466](https://github.com/jlaustill/c-next/issues/1466).

## Moving modules

`npm run move:modules` dry-runs the move described by the manifest in
`scripts/move-modules.ts`; `-- --apply` performs it. The manifest carries the
reason for each destination, so this document and the move stay one decision
rather than two. A pass card adds entries there and rows here.
