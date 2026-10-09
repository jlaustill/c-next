# C-Next Transpiler Architecture

How the transpiler is structured: three layers, eight passes, and a symbol model in which
every fact is authored exactly once.

## Principles

1. **A layer owns a fact if it is the only place that fact may be _authored_.** Everything
   downstream may read it; nothing downstream may recompute it.
2. **Every pass emits a frozen artifact.** The next pass's only input is that artifact.
3. **Freezing prevents writes; the failure to prevent is reads that reconstruct.**
   Immutability alone is insufficient, because re-deriving a fact mutates nothing. The
   components a fact could be rebuilt from must be unreachable from the layers that would
   rebuild it.
4. **The generated C is a certification artifact, and that constrains the language.** Not
   only the formatter. This is why scope depth is bounded.
5. **An invariant without a gate does not count.** State it with its gate or do not state it.

---

## 1. The three layers and eight passes

```
PARSE       1.1 Discover  --> SourceGraph
            1.2 Parse     --> ParsedFile     (per file)
            1.3 Declare   --> FileSymbols    (per file)   Tier 1
            1.4 Resolve   --> Program        (+ query surface)  Tier 2

TRANSPILE   2.1 Analyze   --> Diagnostics
            2.2 Plan      --> EmissionPlan   (decisions live here)
            2.3 Render    --> RenderedFile   (text only)

WRITE       3.1 Write     --> disk
```

### Ownership

| #   | Pass         | Owns -- is sole author of                                                                                      | Emits          |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.1 | **Discover** | which files exist, their kind, the include graph, topological order, every resolved absolute path              | `SourceGraph`  |
| 1.2 | **Parse**    | syntax -- AST, tokens, comments, parse errors                                                                  | `ParsedFile`   |
| 1.3 | **Declare**  | **identity and declaration** -- every symbol a file declares                                                   | `FileSymbols`  |
| 1.4 | **Resolve**  | **every fact requiring more than one file**, and the query surface                                             | `Program`      |
| 2.1 | **Analyze**  | _is this program legal?_ -- all diagnostics, codes, positions                                                  | `Diagnostics`  |
| 2.2 | **Plan**     | _what C should exist?_ -- declarations and order, includes, helpers, MISRA annotations, toolchain requirements | `EmissionPlan` |
| 2.3 | **Render**   | text. Formatting only -- **no decisions**                                                                      | `RenderedFile` |
| 3.1 | **Write**    | the filesystem, exclusively                                                                                    | side effects   |

### The rules that make ownership checkable

- After **1.1**, nothing may discover a file. `node:fs` is reachable only through 3.1 and
  the host port 1.1 publishes.
- After **1.2**, nothing may re-parse. One tree per file, per run.
- After **1.3**, **nothing may compute a symbol's name.** A name is read from the symbol
  that carries it, never rebuilt from a scope and a leaf.
- After **1.4**, nothing may compute a cross-file fact. A pass that needs one reads it from
  `Program`, which is complete before 2.1 begins.
- **2.1 authors every rejection that survives to it.** A diagnostic carries a code and a
  position, which means it cannot originate from a `throw` in a later pass. The exception is
  a rejection of syntactic FORM: a construct the grammar does not admit never produces a
  tree for 2.1 to analyze, so it is authored at 1.2, where it is the only place the
  construct is visible. Such a rejection carries a code and a position like any other -- the
  rule is about where a diagnostic may be INVENTED, not about smuggling an uncoded `throw`
  in earlier. Nested scopes (ADR-016, E0430) are the case this covers.
- **2.2 decides, 2.3 formats.** "Does this file need `<stdint.h>`?" is decided once, in the
  plan. Render reads the plan and produces text from it.

### The layout is the pass table

The eight passes are eight directories. `src/` holds one directory per layer, each holding
one per pass, numbered in the order they run -- and beside them, the roots that are not
passes:

```
src/
  PARSE/
    1-Discover/
    2-Parse/
    3-Declare/
    4-Resolve/
  TRANSPILE/
    1-Analyze/
    2-Plan/
    3-Render/
    CodeGenWalker.ts
    TranspileState.ts
    types/
  WRITE/
    1-Write/
  types/
  utils/
  instrumentation/
  cli/
  lib/
```

The digit is not decoration. A pass may read the artifact of a lower-numbered pass in its
own layer, or of any earlier layer, and nothing else. So "which pass owns this module?"
and "may it read that?" are both answerable from the path -- by a reader, and by a gate --
without opening the file.

**Three entries in `TRANSPILE/` are not passes, and the tree draws them on purpose**
(#1443, owner ruling). `CodeGenWalker.ts` walks one file's plain-data `IProgramSyntax` (never its parse tree, #1932) and calls into both 2.2 Plan and
2.3 Render, so inside `2-Plan/` it would be Plan importing Render. `TranspileState.ts` is
the per-file working data of 2.2 and 2.3. 2.3 and the walker write it. 2.2 writes none of
it, but it reads two things 2.3 wrote earlier in the same file: the current scope path
(`setCurrentScopeByPath`) and the local renames (`registerLocalVariable`, read through
`declarationTypeInfo`). #1313 box 3 records that measurement. Placed in `3-Render/`, the
state made eight Plan modules import Render. `types/` holds `ICodeGenApi`, the slot `TranspileState`
fills. Each still has a place in the pass order: the state comes after 2.1 Analyze, which
may not reach it (#1456), and before 2.2; the walker comes after 2.3. A layer holds its
passes and, beside them, only what the tree draws.

**Every child of `src/` is a directory, and is one of four kinds.** There are no bare
files at the root: an entry point lives inside the root it starts.

- **A layer** -- `PARSE/`, `TRANSPILE/` and `WRITE/`, each holding its passes, as above.
- **Shared contracts** -- `types/` and `utils/`. Layer-neutral: every pass may depend on
  them, and **they author no facts.** A shared root that authors one is a state container
  under another name, which the paragraph below forbids.
- **Host** -- `cli/` and `lib/`. Outside the three layers, and the only place allowed to
  construct the pipeline. Each is entered through its own `index.ts`: the command-line
  tool and the library are separate concerns and do not share a starting point.
- **Instrumentation** -- `instrumentation/`. Records facts about the RUN, never about the
  program: where an ADR's rule fired, which toolchain features a run required. Written
  from any layer, read once by the host, delivered on the run's result. It authors no fact
  the program has, so it is not a state container, and it decides nothing, so it is not a
  pass.

  This kind was added by #1452, and it was added because the taxonomy's absence had
  already misplaced both of its members: `AdrProvenance` sat in a state directory and the
  toolchain-requirement accumulator sat inside `CodeGenState`, each landing wherever it
  was least obviously wrong. A category with no name gets one location per member.

  **It is the one root that may hold mutable state, and the reason is narrow.** Its
  accumulators are written across several passes and what they accumulate is an
  observation of the run, not a fact carried between passes. A pass that read
  instrumentation back would be deriving program behavior from a report about itself;
  that is the line, and it is why `instrumentation/` may not import a layer.

  **"Read once at the end" is not the test -- "nothing branches on it" is**, and the
  distinction matters because the ledger IS read back. `CodeGenWalker.buildBanner` puts
  ` * Requires: C11.` into the generated `.c`, and `captureEmissionFacts` carries
  `takeDeferredSites(...)` into `IEmissionFacts`. Checked, because a rule stated loosely
  reads as violated: `EmissionPlan` branches on `facts.needsFloatStaticAssert` and
  `facts.needsIrqWrappers` -- both render state -- and the sites travel beside them as
  attribution that no decision consults. So no generated CODE differs because of
  instrumentation; a comment and a diagnostic's file:line do.

  `scripts/__tests__/passes-hold-no-mutable-state.test.ts` scans this root **and** the
  layers, with its four holders listed by name. It used not to scan here at all, which
  made the exemption geographic: the four mutable statics #1452 relocated into this root
  left the guard unable to fail on the state that card was about. A list is a thing a
  reviewer can disagree with; a directory boundary is not.

**An import may not go up and then back down into another root.**
`../../types/ITranspileError` is legal; `../../lib/types/ITranspileError` is not. Anything
reached from outside its own root belongs in a shared root, not in another root's
interior -- reaching past a root's entry point into its internals is how a boundary stops
being one. That is what `types/` and `utils/` are for, and why they sit beside the layers
rather than inside one of them.

**There is no directory for state.** A fact lives in the artifact of the pass that authored
it. A container that outlives a pass is how facts come to be stashed instead of carried,
and it is reachable from every pass at once, which is the shape a layer model exists to
forbid.

A separation that holds in every respect except the filesystem is a separation nobody can
check by looking, and one that a reviewer must take on the word of whoever performed it.
The tree is the part of this document that cannot be satisfied by argument. Its gate is
`npm run layout:check`: the first two levels of `src/` must be exactly the tree above, read
from this file, and no module may reach a later pass -- the `*-reads-no-later-pass` rules
`.dependency-cruiser.cjs` generates from its `PASS_ORDER`. The gate also holds the two
lists together: every entry the tree draws inside a layer is covered by exactly one
`PASS_ORDER` place, and the passes appear there in the tree's order, so a pass drawn here
cannot go unbound by the order rules. Changing the layout means changing the drawing and
`PASS_ORDER` together. The interior-import rule above is not yet gated: #1924 tracks it.

## 2. The symbol model

### Two axes, not one

A fact has two independent properties, and conflating them mis-files the AST:

|                                             | **short lifetime** -- gone before 2.2          | **long lifetime** -- travels to 3.1                 |
| ------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| **Tier 1** -- computable with one file open | AST structure                                  | identity, kind, position, declared type, qualifiers |
| **Tier 2** -- needs more than one file      | symbol conflicts (consumed into `Diagnostics`) | `isConst`, opaque-vs-defined, pass-by-value         |

- **Tier** decides which pass authors a fact, and whether it can be cached.
- **Lifetime** decides whether it may cross into the artifact the next layer holds.

The test for tier is mechanical: **could you compute it with only this file open?**

> `cppDetected` used to be listed here as a Tier 2 fact authored in 1.4 Resolve, because it
> was raised by reading an included header. #1319 made it **declared**, from `cppRequired`
> or `--cpp`. #1844 made it **discovered** again, and by 1.1: the run's mode is the
> `SourceGraph`'s `cppMode`, settled before 1.1 returns from each header's language, which
> 1.1 judges once, on the text a C compile meets (#1542, owner ruling 4). Any C++ header makes
> the run C++ (#1428); `cppRequired: true` (`--cpp`) is C++ whatever the headers are, and
> `cppRequired: false` (`--no-cpp`) asks for C, where a C++ header is E0507. It is not a tier
> fact: it is a fact of the include graph, which is 1.1's, and nothing after 1.1 judges a
> header's language again, so nothing downstream can read it too early.
>
> #1428 made that answer the only one. `Program` carries it (`program.cppMode()`, built
> from the graph's; `IProgramInputs.cppMode` is required), and codegen, the header
> generator and 2.1's C++-class initializer check read it there. `ICodeGeneratorOptions`
> and `IHeaderOptions` have no `cppMode` field, so no caller can supply a mode or claim C
> by leaving one out. No type in `src/` declares an optional mode (`cppMode?:`), and
> nothing in `src/`, tests included, defaults one; `OutputExtensions.test.ts` pins all
> three. A test has no 1.1, so it states its mode where it builds the program
> (`ProgramGeneration`, `testAnalysisContextFor`).
>
> The **target catalog** (`targets/targets.cnx`, ADR-049) is a configuration input in the
> same sense: it ships with the compiler, not with the program, and is read and validated
> once per process before any source file is opened.

The AST is Tier 1 with a short lifetime. That resolves the problem of a parse tree that
cannot be serialized, rather than relocating it: pull a serializable `SourceSpan` out and
the tree is confined to a pass whose output is cheap to recompute.

**The tree is gone before 2.2** (owner ruling on #1932). 1.2 Parse builds it; 1.3 Declare
and 2.1 Analyze may read it; nothing from 2.2 Plan on may -- not Plan, not Render, not
`CodeGenWalker`, not Write, and not a helper any of them calls. What a later pass needs of
the syntax it reads as **plain data**, lowered from the tree by `SyntaxLowering`: an
`expression` becomes a `TExpression` and a `type` a `TTypeSyntax` (`src/types/syntax/`).
The shape is the grammar's minus its pass-through levels; every node carries its
`SourceSpan` and, as `written`, its text from the source range -- not `getText()`, whose
joined tokens re-lex as different ones (`1 - -1` reads back `1--1`). A type's `text` is
`getText()`, kept because today's output spells types that way; for an `array` or
`template` it does not lex back as written and must not be re-lexed (#1940). Like a span,
the plain data survives a JSON round trip.

1.2 lowers each file once: `ProgramLowering` turns the `ProgramContext` into an
`IProgramSyntax` -- includes, directives, declarations, function bodies, and the comments
above each item -- and `IParsedFile.program` carries it. `CodeGenWalker` generates from
that and names no parse type (#1932). 1.3 and 2.1 still walk `IParsedFile.tree`, which
they may.

A helper that both sides call is written once, over the plain data: `ConstExprLowering`
lowers a `TExpression`, so 1.3, 2.1 and codegen share one lowering rather than one per
tree reader, and 1.4 resolves the one `TConstExpr` it produces. A pass that still walks the tree hands a helper it shares with a later pass the node's
lowered form, never the node.

A `SourceSpan` is four integers -- `line`, `column`, `endLine`, `endColumn`. It names no
file, because the symbol or diagnostic carrying it already does. It is Tier 1 with a long
lifetime: computable from one file, and needed everywhere a position is reported, which is
as far as 3.1. Position is the only thing later passes want from a tree, so once a span can
travel on its own, nothing downstream has a reason to hold a node.

The table below named `sourceLine` and `sourceColumn` as separate fields while this
paragraph named the record, which are two different shapes for one fact. A symbol carries
the **record**, and it REPLACED the bare line rather than joining it: keeping both would
have left `span.line` and `sourceLine` as two places holding one position, the shape that
put a private type in the public header when `visibility` and a hardcoded flag disagreed.
A symbol's span is its DECLARATION's, so it starts where the declaration starts rather
than at the identifier -- uniform across every kind, because every collector derives it
from the declaration context through one function. For a member the two coincide, since a
member's context is its name.

**Pass 1.3 consumes `ParsedFile` and does not re-export it.** That single rule is what makes
the lifetime axis enforceable -- the tree is not reachable from any artifact a downstream
pass holds, so a dependency rule is a backstop rather than the primary guard.

The backstop now exists (#1317), and since #1932 it is enforced. Two rules in
`.dependency-cruiser.cjs` share one definition of what counts as holding a tree: importing
a generated context, the `antlr4ng` runtime, or a carrier of 1.2's artifact.

- `parse-tree-sites` (`info`) is the inventory: every module outside the parser that holds
  one. `npm run parse-tree:check` holds that population to the baseline in
  [`parse-tree-sites.md`](parse-tree-sites.md); what it forbids is the number RISING.
- `parse-tree-confined-to-parser` (`error`) is the ruling. Only `src/PARSE/` (1.1's
  lexer-only include scan (#1745), 1.2 and 1.3), 2.1, the named shared helpers, and the
  host that routes 1.2's artifact (`src/cli/Transpiler.ts`, which also calls
  `ParserUtils`) may import the grammar. Each named helper is a target of the rule too,
  so a pass after 2.1 that imports one fails as if it had imported the grammar.
- The rule reads imports, not values. A helper a later pass may call must read plain data
  only: `TypeBinding`, which reads parse contexts, is a named helper, and its plain-data
  half, `utils/TypeNameLadder`, is what 2.1, the walker and Render call (#1932). What a
  call returns is checked by type, not by import, in
  `scripts/__tests__/artifact-lifetime.test.ts` (#1957).

A rule over import paths cannot see a structural stand-in: a later pass declaring its own
copy of a context's shape. `scripts/__tests__/artifact-lifetime.test.ts` asks the type
checker instead, whether any parameter or field in 2.2, 2.3, the walker or 3.1 would accept
a generated context. The current count and its per-layer split are in the generated
document, not quoted here -- a number in prose is an ungated reading and rots.

### What a symbol carries

#### Tier 1 -- authored in 1.3 Declare

| fact                                             | note                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                                           | the discriminator; never erased at a layer boundary                                                                                                                       |
| `name`                                           | the leaf, as written in its scope                                                                                                                                         |
| `fullyQualifiedCName`                            | the identifier C sees                                                                                                                                                     |
| `cnxScopedName`                                  | the name the author wrote; what a diagnostic quotes                                                                                                                       |
| scope reference                                  | a path or id, never a live object                                                                                                                                         |
| `sourceFile`, `span`                             | a symbol-level diagnostic can point as precisely as any other                                                                                                             |
| `sourceLanguage`                                 | C-Next, C or C++                                                                                                                                                          |
| `visibility`                                     | public or private, as declared                                                                                                                                            |
| declared type                                    | structured, never flattened to a string at a boundary                                                                                                                     |
| array dimensions                                 | as written; `(number \| string)[]`                                                                                                                                        |
| `isConst` (as written), `isAtomic`, `isVolatile` | qualifiers, on every kind that can carry them                                                                                                                             |
| `overflowBehavior`                               | clamp or wrap, so the declared behavior survives a file boundary                                                                                                          |
| `initialValue`                                   | initializer source text                                                                                                                                                   |
| members as symbols                               | enum members, bitmap fields, register members and struct fields                                                                                                           |
| function parameters, return type                 | ordered, named, typed                                                                                                                                                     |
| is-a-callback-type                               | ADR-029 function-as-type, and its typedef name                                                                                                                            |
| lexical declarations                             | #1668: a file's frames -- each function, block and `for` header -- with the locals and parameters declared in each and where, so a use binds only a declaration before it |

#### Tier 2 -- authored in 1.4 Resolve

Auto-const; parameter-modified, direct and transitive; pass-by-value eligibility; the call
graph; opaque-vs-defined; symbol conflicts; callback promotion; which C
header declares a type; transitively visible enums from includes; const values, every const
folded once and visible by scope and position (#1668, C11); external struct fields; resolved
array dimensions, for variables, parameters, struct fields and locals alike.

> `isExported` is **not** a fact. It is `visibility`, minus ADR-030's `main` exemption,
> minus "a scope is a container, not a declaration". Those rules belong in `EmissionPlan`;
> `visibility` is the Tier 1 fact they are computed from.

### `resolveType` must return a symbol, never a string

Resolving a type to a name discards its kind at the moment of lookup, and a diagnostic
downstream then has nothing to say. `Program.resolveType(name, fromScope)` returns a
**symbol reference**, so "is this a scope type?" is a `kind` check rather than a test
against parallel sets of strings, and "a function was used where a struct was meant" is
answerable.

A type record must not carry a bag of optional booleans -- `isEnum?`, `isBitmap?`,
`isString?` -- standing in for the kind. Such a record can represent contradictory states.

### A scope is a naming context -- nothing else

Scopes are **not namespaces, not objects, not newable.** They take what OOP proved useful
for organization and leave the rest. A scope has no instances, never appears in a type
position, and is not a thing you can hold a value of. In the model it is an **entry in a
table that symbols point at**, not a live object graph they hang off.

A symbol carries its scope as a **path or id**, never as the containing object itself. A
scope held as a live object cannot be serialized, cannot be frozen, and puts one mutable
member list within reach of every symbol in the program.

#### Depth is bounded by the target, not by the language

[ADR-016](../decisions/adr-016-scope.md) decides no nested scopes, permanently. The reason is
pragmatic and has a hard edge: **C99 section 5.2.4.1 guarantees only 31 significant initial
characters in an external identifier**, and MISRA C:2012 Rule 5.1 is evaluated within that
budget.

With 6-character scope names:

| depth | generated name                           | length | distinct within 31? |
| ----- | ---------------------------------------- | ------ | ------------------- |
| 3     | `Scope1__Scope2__Scope3__weight`         | 30     | yes                 |
| 4     | `Scope1__Scope2__Scope3__Scope4__weight` | 38     | **no**              |

So the bound is a property of the **C target**, not of the language:

- the **model** represents a scope path of arbitrary depth -- cheap, and C++ interop needs
  it regardless, since C++ namespaces genuinely nest;
- a **rule in 2.1 Analyze** bounds it, with the threshold read from the target's
  capabilities;
- if C-Next ever becomes a compiler rather than a transpiler, you change a target
  capability, **not the model**.
