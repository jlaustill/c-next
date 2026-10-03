# Module destinations

Where each module under `src/` lives once `src/` is the pass table
([`README.md` §1](README.md)), and why.

This document is **#1443's deliverable 1**, started here by #1472/#1447 because a
pass card cannot move its own modules without saying where they go, and completed
by #1653. Every non-test module under `src/` has a row: the ones already where
they belong, and the ones whose destination is decided and whose move is not yet
possible (`awaiting`, below). `npm run destinations:check` holds that; see
[Checked](#checked) at the end.

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
contract: it goes to §1's `src/types/` root, which every layer may depend on.
Read LAYER here as AREA, a pass or a root such as `utils/` (the owner's
2026-09-30 ruling: a type one area alone names moves into it), counted by where
each importer is GOING, not where it sits (#1853): a type only modules bound
for `src/cli/` name is a host type, however many directories those modules sit
in today.

## `awaiting` is a real destination

A row reading `awaiting #NNNN` means the destination is decided and the move is
not yet possible. That shape is deliberate ([#1313 correction 3](https://github.com/jlaustill/c-next/issues/1313)):
the map has to be able to land before every module can be placed, or it waits on
all nine pass cards and blocks them in turn. It is ratcheted — a row may move
from `awaiting` to a real path, never back.

## PARSE

### 1.1 Discover — `src/PARSE/1-Discover/`

Created by #1444, which writes its own rows as every pass card before it did.

| module                                                                                                                                                                                                                         | why                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Discover.ts`                                                                                                                                                                                                                  | the pass itself: a run's input becomes one frozen `SourceGraph`, and nothing after it resolves an include                                                                                                                                                                                                                                                                                |
| `RunAnchor.ts`                                                                                                                                                                                                                 | where a run is anchored (#1719): its project root, the compile database that root names, and the preprocessor and `PathResolver` they pick. Discovery decides it per run, and the constructor asks the same function for the cache's project root                                                                                                                                        |
| `ReadOnceFileSystem.ts`                                                                                                                                                                                                        | one run's read-only view of the host port, in which each file's text is read once (owner ruling 3 on #1444): 1.1 reads through it, so its include discovery and the `platformio.ini` it parses for ADR-049 see one version of the file                                                                                                                                                   |
| `types/**`                                                                                                                                                                                                                     | the artifact 1.1 emits and its parts: `ISourceGraph`, each file's `IPipelineFile` and `IFileIncludes`, a discovered file's kind (`EFileType`, `IDiscoveredFile`), a header root, and the `IRunAnchor` 1.1 decides. A later pass may read them; `nothing-after-1-1-discovers` exempts this directory and nothing else                                                                     |
| `types/IInMemorySource.ts`                                                                                                                                                                                                     | the in-memory sources a run is given, which 1.1 reads as its input: only `Discover.ts` names it. Moved from the shared root by #1853                                                                                                                                                                                                                                                     |
| `CNextMarkerDetector.ts`, `CppEntryPointScanner.ts`, `DependencyGraph.ts`, `FileDiscovery.ts`, `IncludeDiscovery.ts`, `IncludeResolver.ts`, `InputExpansion.ts`, `PathResolver.ts`, `PlatformIOIni.ts`, `TargetCatalogFile.ts` | which files exist, their kind, the include graph and every resolved path: 1.1's ownership in §1. Moved from `src/transpiler/data/` by #1444                                                                                                                                                                                                                                              |
| `detectCppSyntax.ts`, `detectAssemblySyntax.ts`                                                                                                                                                                                | sniff a header's language (C, C++ or assembler), which §1 gives to 1.1: "which files exist, their kind". **1.1 does not run them yet**: their only callers are the orchestrator's Stage 2, on the raw header and again on the preprocessed one, and the `SourceGraph` carries only the extension's kind. #1844 decides whose decision it is. Moved from `src/transpiler/logic/` by #1444 |
| `preprocessor/**`                                                                                                                                                                                                              | owner ruling 15. Its `node:fs` reads go through the port since #1653, which carries #1451 box 2, and its temporary file is the port's `withTempFile`. Moved from `src/transpiler/logic/preprocessor/` by #1444                                                                                                                                                                           |
| `NodeFileSystem.ts`                                                                                                                                                                                                            | the production `IFileSystem`: the host port 1.1 publishes. It is the only module that imports `node:fs`: 3.1 writes through it, and owner ruling 2026-09-30 puts `cli/` under #1451 box 3 too. Moved from `src/transpiler/` by #1444                                                                                                                                                     |

### 1.2 Parse — `src/PARSE/2-Parse/`

Moved as a tree (#1445 box 4, absorbing this card's 1.2 Parse rows and move at
the maintainer's direction). `src/transpiler/logic/parser/` no longer exists.

| module                           | why                                                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CNextSourceParser.ts`           | the pass itself: source text becomes one `IParsedFile`, once                                                                                                         |
| `CommentScanner.ts`              | reads comments off the hidden channel of that parse; a fact about the parse, not about a pass above it                                                               |
| `HeaderParser.ts`                | the same for a C or C++ header                                                                                                                                       |
| `grammar/**`                     | ANTLR's output for `grammar/CNext.g4` — the tree 1.2 produces, so it lives with the pass that produces it                                                            |
| `c/grammar/**`, `cpp/grammar/**` | the same for the C and C++ grammars                                                                                                                                  |
| `TargetCatalogParser.ts`         | ADR-049: reads the target catalog, a C-Next source file, with the real grammar. It is the only module that sees the catalog's tree, so what leaves 1.2 is plain data |
| `TargetDirectives.ts`            | ADR-049: splits a file's `#pragma` token into its key and values, the one reader of pragma text                                                                      |

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

| module                                                                       | why                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cnext/index.ts`                                                             | `CNextResolver`: collects what ONE C-Next file declares                                                                                                                                                            |
| `cnext/collectors/**`                                                        | each takes a single parse tree                                                                                                                                                                                     |
| `cnext/collectors/BITMAP_BACKING_TYPE.ts`, `cnext/collectors/BITMAP_SIZE.ts` | constants, not collectors: read only by `BitmapCollector`, so they sit beside it. Moved from `src/transpiler/constants/` by #1853                                                                                  |
| `cnext/utils/**`                                                             | type and expression helpers used while collecting one file                                                                                                                                                         |
| `cnext/types/**`                                                             | the collectors' own result shape                                                                                                                                                                                   |
| `cnext/adapters/TSymbolInfoAdapter.ts`                                       | **resolved** — `convert()` stays in 1.3; `mergeOpaqueTypes` deleted (the fact is `Program`'s, so there was nothing to merge); the visibility composition moved to 1.4 as `VisibleSymbols`                          | Was blocked on `ICodeGenSymbols` no longer being the per-file view codegen reads. It is not one now: 1.4 composes each file's VISIBLE view once, at build, and codegen reads that. The composition used to run per file while rendering, over a map the publish loop was still filling — #1301 is that bug (#1511) |
| `c/**`, `cpp/**`                                                             | collect what one C or C++ header declares                                                                                                                                                                          |
| `shared/**`                                                                  | parameter extraction shared by the C and C++ collectors                                                                                                                                                            |
| `TypeBinding.ts`                                                             | the one ladder from a type context to a name; reads the tree and an injected predicate                                                                                                                             |
| `TYPE_FORMING_KINDS.ts`                                                      | which kinds introduce a type name — a constant                                                                                                                                                                     |
| `SymbolUtils.ts`                                                             | helpers for the C and C++ collectors, per declaration                                                                                                                                                              |
| `NameExistence.ts`                                                           | asks the PER-FILE view whether a name exists; its own header states that split                                                                                                                                     |
| `cnext/collectors/LexicalScopeCollector.ts`                                  | #1668: one file's lexical frames -- each function, block and `for` header, with the locals and parameters declared in it and where. A dimension naming a const is left as text for 1.4 to fold where it is written |
| `cnext/collectors/ModificationCollector.ts`                                  | #1825: ADR-006's per-file half -- each function's parameters, its direct writes to them, and the calls it passes them to, with a bare callee recorded as written for 1.4 to resolve                                |
| `cnext/collectors/CallbackUseCollector.ts`                                   | #1825: ADR-029's per-file half -- where the file names what may be a function in a position a C callback could be expected. 1.4 decides which are callbacks                                                        |

### 1.4 Resolve — `src/PARSE/4-Resolve/`

| module                                                                                                                                          | why                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Program.ts`                                                                                                                                    | the artifact 1.4 emits                                                                                                                                                                                                                                                                              |
| `DeferredTypes.ts`                                                                                                                              | settles bare names against the scope types each file can see                                                                                                                                                                                                                                        |
| `TransitiveEnumCollector.ts`                                                                                                                    | walks the include graph, so it needs the graph rather than a file                                                                                                                                                                                                                                   |
| `LexicalFrames.ts`                                                                                                                              | #1668: settles each file's frames against the scope types that file can see and the program's consts, and answers what a name binds at a position (`declarationAt`) and which consts are visible there (`constValuesAt`)                                                                            |
| `VisibleSymbols.ts`                                                                                                                             | what each file can SEE: the file and its include closure, local names winning. 1.3's per-file `convert()` cannot compose it (#1511)                                                                                                                                                                 |
| `ConflictDetector.ts`                                                                                                                           | symbol conflicts: two files defining one name, a fact that exists only across files (#1511)                                                                                                                                                                                                         |
| `RunTarget.ts`                                                                                                                                  | ADR-049: settles the run's one target from every file's pragmas and the catalog, a whole-program answer                                                                                                                                                                                             |
| `TargetDescriptions.ts`                                                                                                                         | ADR-049: the one judge of a target description, catalog row and inline pragmas alike, read where `RunTarget` settles the target                                                                                                                                                                     |
| `types/IBindingFacts.ts`                                                                                                                        | what `Program.bindValue` reads to decide what a spelling means, built from the frames 1.4 settles (#1664 review)                                                                                                                                                                                    |
| `types/IForeignSymbols.ts`, `types/IProgramInputs.ts`, `types/IRunTargetInputs.ts`, `types/IVisibilityInput.ts`, `types/ITransitiveIncludes.ts` | what `Program.build` and `RunTarget` take in, and the include map `TransitiveEnumCollector` walks. Only 1.4 names them, so they moved here from the shared root (#1653, owner ruling 2026-09-30)                                                                                                    |
| `SMALL_PRIMITIVES.ts`, `TARGET_DESCRIPTION_FIELDS.ts`                                                                                           | constants only 1.4 reads: `Program`, and `RunTarget` with `TargetDescriptions`. Moved from `src/transpiler/constants/` by #1853                                                                                                                                                                     |
| `types/IModificationFacts.ts`                                                                                                                   | the modification facts `ModificationFacts` derives and `Program.build` takes in. Only 1.4 names it. Moved from the shared root by #1853                                                                                                                                                             |
| `types/ITargetFieldSpec.ts`                                                                                                                     | the shape of one target-description field, read by `TargetDescriptions` and `TARGET_DESCRIPTION_FIELDS`. Moved from the shared root by #1853                                                                                                                                                        |
| `ModificationFacts.ts`                                                                                                                          | ADR-006: which parameters the whole program modifies. It resolves each bare callee 1.3 recorded and propagates along the call graph, since a callee is routinely in another file. Moved from `src/transpiler/` by #1825, once 1.3 collected what it reads                                           |
| `TransitiveModificationPropagator.ts`                                                                                                           | propagates parameter modification to a fixed point over the whole call graph, for `ModificationFacts`. Moved from 2.2 by #1825                                                                                                                                                                      |
| `CallbackCompatibility.ts`                                                                                                                      | ADR-029: which functions the whole program uses as callbacks. It applies the one recognition rule to the uses 1.3 recorded, since the typedef is a header's and the function may be declared in any file (#1544). Moved from `src/transpiler/` by #1825, where it ran a 2.1 analyzer for the answer |

## TRANSPILE

### 2.1 Analyze — `src/TRANSPILE/1-Analyze/`

| module                                          | why                                                                                                                                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**`                                            | the analyzers and the helpers they share, moved as a tree out of `src/transpiler/logic/analysis/`, which no longer exists, beginning with `6e46f6d4` (#1322). They answer _is this program legal?_ |
| `BUILTIN_TYPE_NAMES.ts`, `REJECTED_KEYWORDS.ts` | constants only 2.1 reads (`UndeclaredTypeAnalyzer`, `UndeclaredValueAnalyzer`, `LoopAnalyzer`). Moved from `src/transpiler/constants/` by #1853, not with the tree above                           |

They arrived as renames, so the "created here rather than moved" exemption 2.2
Plan carries does not apply. The pass is rowed as a tree, like 2.3 Render,
because it moved as one.

### 2.2 Plan — `src/TRANSPILE/2-Plan/`

| module                           | why                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmissionPlan.ts`                | decides what C should exist for one file — the artifact 2.2 emits                                                                                                                                                   |
| `ComplianceAnnotations.ts`       | which safety-standard rule shaped a construct, and the one rendering of the house form                                                                                                                              |
| `HeaderTypeNames.ts`             | every type name a file's public header will name — one enumeration, where two derivations each stopped at functions and variables (#1520)                                                                           |
| `PublicInterface.ts`             | which symbols form a file's public C interface — `isExported` minus ADR-030's `main` exemption minus "a scope is a container", which §2 assigns to `EmissionPlan`                                                   |
| `StringLengthCounter.ts`         | which `.char_count` reads are worth hoisting into a cached `strlen` temp — a choice about what C exists, not how it reads (#1445 box 3)                                                                             |
| `DeclaredTypeInfo.ts`            | a binding's declared type in the `TTypeInfo` shape 2.2 and render read -- local, parameter, global and cross-file global alike -- and what an assignment target writes (#1668)                                      |
| `PlanTyping.ts`                  | the rows 2.2 reads over the one operand typer's facts — the direct type, a cast's source type, a composite's ADR-044 behavior — so each 2.2 site asks one named rule rather than re-deriving it (#1668)             |
| `AssignmentContextBuilder.ts`    | turns an assignment statement into the `IAssignmentContext` that `AssignmentClassifier` decides the kind from — the input half of a decision 2.2 already owns (#1445 box 3)                                         |
| `dimensionEvalOptions.ts`        | the const-evaluation options both array-dimension paths must share, so the two cannot diverge on what folds                                                                                                         |
| `AssignmentClassifier.ts`        | ADR-065: which `AssignmentKind` an assignment is, and so which handler shapes its C. The handlers under `3-Render/` print the answer and do not choose it                                                           |
| `CppMemberHelper.ts`             | whether passing a struct member in C++ mode needs a temporary (#251, #252, #256). It decides whether a variable exists, which is what C there is                                                                    |
| `CastRequirement.ts`             | MISRA C:2012 Rule 10.3: whether a conversion needs an explicit cast. Render's `NarrowingCastHelper` only spells the cast (#1450 box 4)                                                                              |
| `DeclarationPlan.ts`             | what this file's declarations look like, and their order, settled before any is rendered (#1450)                                                                                                                    |
| `HeaderIncludes.ts`              | which system headers a file's public header includes (#1517)                                                                                                                                                        |
| `SYSTEM_INCLUDE_TARGETS.ts`      | how each system header is spelled when emitted, the one table both of 2.2's include decisions read (`EmissionPlan`, `HeaderIncludes`). Moved from `src/transpiler/constants/` by #1853                              |
| `HeaderOwnership.ts`             | which declarations the included header owns, so the `.c` does not emit them a second time (#369, #1164)                                                                                                             |
| `MisraSuppressions.ts`           | which generated `#include` carries a cppcheck suppression, and under which MISRA rule. Dropping one changes what is emitted (#1450 box 4)                                                                           |
| `SubscriptDepthValidator.ts`     | ADR-036 and ADR-007's subscript-depth rule, stated once. 2.2 and render assert it as an invariant, since E0856 in 2.1 rejects a deeper chain first (#1106, #1322)                                                   |
| `PassByValueAnalyzer.ts`         | the render-time query `isParameterPassByValue*`: ADR-006 for render, read from 1.4's decision. Its collection walk moved to 1.3 (`ModificationCollector`) and its propagation to 1.4 (`ModificationFacts`) by #1825 |
| `types/IAssignmentContext.ts`    | ADR-065: what `AssignmentContextBuilder` builds and `AssignmentClassifier` decides from. Moved in by #1452 (`e9677f2f8`)                                                                                            |
| `types/IChainBase.ts`            | what an assignment target writes, bound once where the target is typed (#1668, created here as `ITargetDeclaration`)                                                                                                |
| `types/IComplianceAnnotation.ts` | what `ComplianceAnnotations` returns: the standard, rule and reason for one construct. Only 2.2 names it, so it moved here from the shared root (#1653, owner ruling 2026-09-30)                                    |

Nine modules here were created rather than moved, because 2.2 Plan did not exist
as a module anywhere: `EmissionPlan`, `ComplianceAnnotations`, `HeaderTypeNames`,
`CastRequirement`, `DeclarationPlan`, `HeaderIncludes`, `HeaderOwnership`,
`MisraSuppressions` and `types/IChainBase`. A tenth, `types/IModificationCollector`,
was created here too and moved to 1.3 with the walk that fills it (#1825).
`git log --diff-filter=A --follow` gives each an add commit at its path. None
has a rename, except that `IChainBase` was renamed once inside this directory,
from `ITargetDeclaration` (`763583912`). The rest were moved in by
`scripts/move-modules/MOVES.ts`. Its `because` strings argue why each module left
where it was. The rows above state what each module owns now, which is a
different claim.

#1323's `HeaderRenderer` (`HeaderEmissionPlanner` until #1449) is **not** listed
— it renders header text from already-decided facts, which is 2.3 by the
discriminator above.

## Not a pass — `src/TRANSPILE/`

| module                 | why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CodeGenWalker.ts`     | walks one file's parse tree and drives 2.2 and 2.3 over it — the role `Transpiler` plays for a whole run, which is why `src/transpiler/` already holds three tree-walking modules (#1445 box 3)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `TranspileState.ts`    | the per-file working state 2.2 Plan and 2.3 Render share — `CodeGenState` and `TranspilerState` merged into one instance (#1452 boxes 1 and 4). It sits here for the SAME reason as the row above, and the reason was measured rather than argued: placed in `3-Render/` first, `depcruise` reported **8** `plan-cannot-import-render` errors, because six `2-Plan/` modules import it directly and two more reach it through `IAssignmentContext`. Two of them WRITE it (`TypeRegistrationEngine`, `TypeRegistrationUtils`, both via `setVariableTypeInfo`), so it is not render's state and the name it carried said otherwise |
| `types/ICodeGenApi.ts` | the generator dispatch surface `TranspileState` holds, and nothing else names. It moved from the shared root (#1653, owner ruling 2026-09-30) into a `types/` directory beside the two non-pass modules here, which sit at this root for the reason given above                                                                                                                                                                                                                                                                                                                                                                  |

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

| module                                                                                                                                                            | why                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QualifiedNameGenerator.ts`                                                                                                                                       | builds a qualified C name from a scope path; imports only `SymbolRegistry` and `ScopeUtils`, and `2-Plan/` needs it too, which `plan-cannot-import-render` forbade while it sat in render (#1445 box 3)                                                                     |
| `ast/AssignmentTargetExtractor.ts`                                                                                                                                | a generic parse-tree walker two passes reach (#1322)                                                                                                                                                                                                                        |
| `ast/ChildStatementCollector.ts`                                                                                                                                  | answers _what statements are inside this one?_ — a question about the tree, not about legality (#1322)                                                                                                                                                                      |
| `OperandTyper.ts`                                                                                                                                                 | #1668: the one operand typer. It types every operand shape for 2.1 and 2.2 alike, over the program's bindings, so the rules and the emitted C read one answer                                                                                                               |
| `CompositeType.ts`                                                                                                                                                | #1668: a composite's type and its floating veto, from the typer's leaves; the rule E0810 and 2.2's clamp routing both read                                                                                                                                                  |
| `DeclaredPointer.ts`                                                                                                                                              | #1668: whether a declaration is emitted as a pointer (a `*` type, an opaque typedef struct, a C call returning one, ADR-046's `c_` rule), for the `.c` and the `.h` alike                                                                                                   |
| `SubscriptClassifier.ts`                                                                                                                                          | an element, a slice, a bit or a bit range, from what is subscripted; the typer asks it for each step                                                                                                                                                                        |
| `ChainRoot.ts`                                                                                                                                                    | a postfix chain's `this`/`global`/bare root, as the source spells it                                                                                                                                                                                                        |
| `IncludeRewriter.ts`                                                                                                                                              | renders a `.cnx` include as C text and decides nothing (#1467). 1.1 renders a file's user includes with it and 2.3 renders the `.c`'s; whether a directive is C-Next is 1.1's answer, which both read (owner ruling 1 on #1444). Moved from `src/transpiler/data/` by #1444 |
| `constants/LANGUAGE_STANDARD_FAMILY.ts`, `constants/LANGUAGE_STANDARD_ORDER.ts`, `constants/STRUCT_POINTER_C_FUNCTIONS.ts`, `constants/TOOLCHAIN_REQUIREMENTS.ts` | each read only by one `utils/` module (`ToolchainRequirementUtils`, `DeclaredPointer`). Moved from `src/transpiler/constants/` by #1853                                                                                                                                     |
| `*.ts`, `ast/**`, `constants/**`, `types/**`                                                                                                                      | the rest of `src/utils/`, in place: §1's layer-neutral root. The rows above are the ones a move brought here and had to argue. `cache/` is not here, because it serves only the orchestrator (see Awaiting a move)                                                          |

A module arrives here when more than one pass reaches it and it decides nothing
about the program — the admission test §1 states, answered "neither pass owns
this".

`TSymbolInfoAdapter`'s split, which a `Blocked` table here used to record as
half done, is finished. `mergeExternalSymbols` is now
`4-Resolve/VisibleSymbols.ts`, as the 1.3 Declare row above says.
`src/transpiler/logic/symbols/` no longer exists: #1511 moved `SymbolTable.ts`
out of it, and #1452 moved it again — see below.

## Shared contracts — `src/types/`

§1's other layer-neutral root. Every pass may depend on it, it authors no facts,
and `shared-contracts-cannot-import-a-pass` holds it to importing no pass.

| module | why                                                                                                                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**`   | a type or constant more than one area names, counted by where each importer is going rather than where it sits. Moved from `src/transpiler/types/` and `src/transpiler/constants/` by #1853, which derived each module from its importers and iterated until no classification changed |

## 1.3 Declare — the symbol artifacts (#1452 box 1)

`src/transpiler/state/` **is removed** — `ls` it and there is nothing there — so the
two modules it held that are not per-file working state needed a destination that is
not "state". (The working state itself is `TranspileState.ts`, one section up: it is
shared by 2.2 and 2.3, so "render state" was the wrong description of it too.)

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
`_restoreCachedHeader`, `parsePureCHeader`, `parseCppHeader`). Each is
computable with one parse tree open. The accumulation across files is
`Transpiler`'s loop, not the table's doing.

Recording this here because #1511's row was right to demand maintainer approval
for changing a decided destination, and the owner's direction on #1452 is that
`src/transpiler/state/` goes away — which retires the destination rather than
the reasoning behind it.

## Deleted rather than re-homed (#1653)

| module                                   | outcome                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/transpiler/data/CnxFileResolver.ts` | **Deleted** (#1137, carried here by #1653). It called `existsSync` past the injected port, and nothing outside tests imported it after `5737557be` moved the include check to the port. A `MockFileSystem` test and its E0506 control now pin that the check uses the port |

## Deleted rather than re-homed (#1668)

#1668 gives every pass one operand typer, which binds a name through the
program's lexical frames and types every operand shape. These modules each
answered part of that question with a derivation of their own, so the typer
replaces them rather than receiving them.

| module                                                                                                                                                                               | outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2-Plan/ExpressionTypeResolver.ts`                                                                                                                                                   | **Deleted.** 2.2's type for an expression. Its direct type is `PlanTyping.directTypeName`, its composite type and floating veto are `CompositeType`'s — the rule 2.1's diagnostics read — and its four type predicates were copies of `TypeCheckUtils`'s over the same lists, and of `DeclaredTypeFacts.isStruct`. It could not type a call, which the typer can; measured at deletion, that changed two fixtures and nothing else.                                    |
| `3-Render/codegen/resolution/EnumTypeResolver.ts`                                                                                                                                    | **Deleted.** "Which enum type is this expression", answered by splitting source text. The typer's `enumTypeName` answers it for 2.2 and for ADR-017's 2.1 rules alike. Its premise — that the passes ask from different symbol views, so nothing detects a disagreement — no longer holds: both read one symbol view through one typer.                                                                                                                                |
| `2-Plan/TypeRegistrationEngine.ts`, `2-Plan/TypeRegistrationUtils.ts`                                                                                                                | **Deleted**, with the per-file type registry they wrote. Every read binds the declaration it means and projects it (`DeclaredTypeInfo`), so nothing is registered. A registry keyed by name could not tell an inner block's `x` from its sibling's, nor `global.x` from a local `x`. Their other two jobs moved: the `<string.h>` a sized string needs is raised on its declaration's plan, and global const folding moved to 1.4, which folds every const once (C11). |
| `1-Analyze/OperandTypeResolver.ts`, `1-Analyze/ScopeFrameResolver.ts`, `1-Analyze/DeclarationScopeCollector.ts`, `1-Analyze/types/IScopeFrame.ts`, `1-Analyze/types/IDeclaredVar.ts` | **Deleted** (C11). 2.1's own lexical frames and operand typing: a frame per scope recorded each declaration by name with no position, so a use saw a declaration below it (#1702), and a flat set of bare names answered across functions (#1694). The binder (`LexicalFrames`, `Program.bindValue`) and the typer replace them. `ArrayIndexBoundsAnalyzer` was the last user.                                                                                         |

## Deleted rather than re-homed (#1444)

| module                                         | outcome                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/PARSE/4-Resolve/types/IDiscoveryFacts.ts` | **Deleted.** Four of 1.1's include facts, carried on 1.4's `Program` because 1.1 had no artifact of its own (#1452). They are `SourceGraph.includes` now, and `Program` answers no question about includes                                                           |
| `src/transpiler/types/IPipelineInput.ts`       | **Deleted.** The pipeline's input record, which only discovery built. It became `ISourceGraph` rather than living beside it, which would have been two types for one fact                                                                                            |
| `src/transpiler/logic/IncludeExtractor.ts`     | **Deleted.** It derived a file's user includes from 1.2's tree in Stage 5, after 1.1 had already lexed the same tokens. `IncludeResolver` keeps the token texts and renders them, so the includes are a 1.1 fact, as the owner's exception on #1452 box 2 names them |

## 2.3 Render — moved as a tree (#1450 box 5)

`src/transpiler/output/` **is** the render pass: codegen and header generation,
**144** non-test modules (251 files with their tests). It moved whole to
`src/TRANSPILE/3-Render/`, the way 2.1 Analyze did, rather than file by file.

| module                      | why                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/TRANSPILE/3-Render/**` | the render pass: every module turns settled decisions into text, a property `render-decides-nothing.test.ts` gates |

The manifest entry in `scripts/move-modules/MOVES.ts` carries the reason; the short
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

## WRITE

### 3.1 Write — `src/WRITE/1-Write/`

Created by #1653, which carries #1451. Nothing moved in: every change to the
filesystem already went through the port or `node:fs` at its call site, and each
call site now asks this module instead.

| module     | why                                                                                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Write.ts` | the only module that changes the filesystem: files written, directories created, files deleted and moved, through the port the host injects. `write-confined-to-3-1.test.ts` holds that no other module calls the port's mutating methods |

## Host — `src/cli/` and `src/lib/`

§1's host roots, outside the three layers and the only places allowed to
construct the pipeline. #1466 gave them that home. Both are already there.

| module       | why                                                                                |
| ------------ | ---------------------------------------------------------------------------------- |
| `src/cli/**` | the command-line tool                                                              |
| `src/lib/**` | the library's entry points, `parseWithSymbols` and `parseCHeader`, and their types |

## Awaiting a move

Every row here is decided and cannot move yet. Each one names the card that
moves it. `scripts/module-destinations/AWAITING_ROWS.ts` holds exactly these
paths, so the set can shrink and cannot grow (owner ruling 17). Neither 1.1
Discover nor 3.1 Write has a directory yet, so every module bound for one of
them is here.

| module                             | destination                                                                              | why                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/cache/**`               | `src/cli/`, awaiting #1443                                                               | the header-symbol cache. Its only user is the orchestrator: `Transpiler` imports `CacheManager` and `CachedSymbolReader`, and nothing else imports the other two. It imports 1.3's `SymbolTable` and 3.1's `Write`, so it is not a layer-neutral shared contract. It goes with the orchestrator's pipeline-constructing remainder to `cli/` (#1653)                         |
| `src/transpiler/Transpiler.ts`     | split across the passes. What constructs the pipeline goes to `src/cli/`, awaiting #1443 | the orchestrator. #1443 records the split ("splits across all eight"), §1 lets only the host construct the pipeline, and `cli/` is the only host that does: `lib/` never imports `Transpiler` (measured 2026-09-30, owner's question)                                                                                                                                       |
| `src/transpiler/types/**`          | `src/cli/`, awaiting #1443                                                               | the four host types: `ITranspilerResult` (named by `cli/` and the orchestrator), `IRenderedFile` (the orchestrator), and `ICacheConfig` with `ICachedFileEntry` (the cache, itself bound for `src/cli/`). By destination only the host names them (#1853). Moving them before their importers would have `utils/` reach into a host root's interior, so they move with them |
| `src/index.ts`                     | `src/cli/index.ts`, awaiting #1443                                                       | the CLI's entry point. §1 allows no bare file at `src/`, and each host root is entered through its own `index.ts`                                                                                                                                                                                                                                                           |
| `src/tests/utils/FunctionUtils.ts` | `src/PARSE/3-Declare/__tests__/`, awaiting #1443                                         | a test-only fixture factory (#1511 took it off the production path, `a6a045528`). Its one importer is `3-Declare/__tests__/SymbolRegistry.test.ts`, and `tests/` is not a §1 root                                                                                                                                                                                           |

"Read only by" is measured over non-test importers, at `a5b2ef429`.

## Moving modules

`npm run move:modules` dry-runs the move described by the manifest in
`scripts/move-modules/MOVES.ts`; `-- --apply` performs it. The manifest carries the
reason for each destination, so this document and the move stay one decision
rather than two. A pass card adds entries there and rows here.

## Checked

`npm run destinations:check` runs in the `lint` job (#1653). It fails when:

- a non-test module under `src/` has no row;
- one row places a module and another says it is awaiting a move, or two rows await
  different cards: the table would give two answers for one module;
- a row matches no module, because a module moved or was deleted and a row naming a
  path that is gone would otherwise pass without checking anything;
- the `awaiting` set grows, which means a row this table reads as `awaiting` is not
  in `scripts/module-destinations/AWAITING_ROWS.ts`;
- `AWAITING_ROWS.ts` holds a path this table no longer reads as `awaiting`, so a
  module that has moved gives its allowance up in the same commit.

It never fails on an `awaiting` row as such. A row resolves against the `src/…/`
directory its section heading names, or is spelled from `src/`. In a table with a
`destination` column, it resolves against the destination, or against the module's
own path while that destination is `awaiting`. Tables with an `outcome` column
record deleted modules and place nothing. Test support is not a module here: `__tests__/`,
`__testUtils__/` and `*.test.ts` are left out, the same split `.dependency-cruiser.cjs`
makes.
