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

| module                                 | why                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `cnext/index.ts`                       | `CNextResolver`: collects what ONE C-Next file declares                                |
| `cnext/collectors/**`                  | each takes a single parse tree                                                         |
| `cnext/utils/**`                       | type and expression helpers used while collecting one file                             |
| `cnext/types/**`                       | the collectors' own result shape                                                       |
| `cnext/adapters/TSymbolInfoAdapter.ts` | `convert()` is per-file — but see the split below                                      |
| `c/**`, `cpp/**`                       | collect what one C or C++ header declares                                              |
| `shared/**`                            | parameter extraction shared by the C and C++ collectors                                |
| `TypeBinding.ts`                       | the one ladder from a type context to a name; reads the tree and an injected predicate |
| `TYPE_FORMING_KINDS.ts`                | which kinds introduce a type name — a constant                                         |
| `SymbolUtils.ts`                       | helpers for the C and C++ collectors, per declaration                                  |
| `NameExistence.ts`                     | asks the PER-FILE view whether a name exists; its own header states that split         |

### 1.4 Resolve — `src/PARSE/4-Resolve/`

| module                       | why                                                               |
| ---------------------------- | ----------------------------------------------------------------- |
| `Program.ts`                 | the artifact 1.4 emits                                            |
| `DeferredTypes.ts`           | settles bare names against the whole-program scope-type set       |
| `TransitiveEnumCollector.ts` | walks the include graph, so it needs the graph rather than a file |

## TRANSPILE

### 2.2 Plan — `src/TRANSPILE/2-Plan/`

| module            | why                                                               |
| ----------------- | ----------------------------------------------------------------- |
| `EmissionPlan.ts` | decides what C should exist for one file — the artifact 2.2 emits |

Created here rather than moved: 2.2 Plan did not exist as a module anywhere, so
there was nothing to relocate. #1323's `HeaderEmissionPlanner` is **not** listed
— it renders header text from already-decided facts, which is 2.3 by the
discriminator above.

## Blocked

| module                                 | destination                                                                                                      | blocked on                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logic/symbols/SymbolTable.ts`         | `awaiting` 1.4 Resolve                                                                                           | 1.3 Declare imports it: the C and C++ collectors take a `SymbolTable` parameter. Moving it now makes a 3-Declare → 4-Resolve edge, which is the pass order backwards. The edges are type-only, so this is shallow coupling, but it is not this card's to remove                                                                                                                                                                                                                                                                                                                                       |
| `logic/symbols/PublicInterface.ts`     | `awaiting` **2.2 Plan**                                                                                          | Destination corrected by #1449. It read `awaiting 1.4 Resolve`, which the two-way rule above was the only test available to produce; §1 assigns the computation to 2.2 — "`isExported` is **not** a fact… Those rules belong in `EmissionPlan`". The move is still blocked, and by a WORSE edge than the row recorded: `TSymbolInfoAdapter` (1.3 Declare) calls `PublicInterface.existsIn`, so once the destination is 2.2 that is a PARSE → TRANSPILE edge — a layer crossed backwards, not one pass. Tracked as [#1515](https://github.com/jlaustill/c-next/issues/1515); not this card's to remove |
| `cnext/adapters/TSymbolInfoAdapter.ts` | **split** — `convert()` stays in 1.3; `mergeExternalSymbols`/`mergeOpaqueTypes` are cross-file and belong in 1.4 | the merge half is only reachable once `ICodeGenSymbols` stops being the per-file view codegen reads                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Those three are the measurement behind "the pass split is not finished", and
they are why `src/transpiler/logic/symbols/` still exists.

## Not yet placed

The other five passes (1.1 Discover, 1.2 Parse, 2.1 Analyze, 2.3 Render, 3.1
Write) have no rows here, and neither do the 60 genuinely-shared
modules or `cli/`, `lib/` and `index.ts` — §1's tree names no home for the last
group, which is [#1466](https://github.com/jlaustill/c-next/issues/1466).

## Moving modules

`npm run move:modules` dry-runs the move described by the manifest in
`scripts/move-modules.ts`; `-- --apply` performs it. The manifest carries the
reason for each destination, so this document and the move stay one decision
rather than two. A pass card adds entries there and rows here.
