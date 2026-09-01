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
- **2.1 authors every rejection.** A diagnostic carries a code and a position, which means
  it cannot originate from a `throw` in a later pass.
- **2.2 decides, 2.3 formats.** "Does this file need `<stdint.h>`?" is decided once, in the
  plan. Render reads the plan and produces text from it.

### The layout is the pass table

The eight passes are eight directories. `src/` holds one directory per layer, each holding
one per pass, numbered in the order they run:

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
  WRITE/
    1-Write/
```

The digit is not decoration. A pass may read the artifact of a lower-numbered pass in its
own layer, or of any earlier layer, and nothing else. So "which pass owns this module?"
and "may it read that?" are both answerable from the path -- by a reader, and by a gate --
without opening the file.

**There is no directory for state.** A fact lives in the artifact of the pass that authored
it. A container that outlives a pass is how facts come to be stashed instead of carried,
and it is reachable from every pass at once, which is the shape a layer model exists to
forbid.

A separation that holds in every respect except the filesystem is a separation nobody can
check by looking, and one that a reviewer must take on the word of whoever performed it.
The tree is the part of this document that cannot be satisfied by argument. Its gate is
`npm run layout:check`.

## 2. The symbol model

### Two axes, not one

A fact has two independent properties, and conflating them mis-files the AST:

|                                             | **short lifetime** -- dies by 2.2              | **long lifetime** -- travels to 3.1                 |
| ------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| **Tier 1** -- computable with one file open | AST structure                                  | identity, kind, position, declared type, qualifiers |
| **Tier 2** -- needs more than one file      | symbol conflicts (consumed into `Diagnostics`) | `isConst`, opaque-vs-defined, pass-by-value         |

- **Tier** decides which pass authors a fact, and whether it can be cached.
- **Lifetime** decides whether it may cross into the artifact the next layer holds.

The test for tier is mechanical: **could you compute it with only this file open?**

> `cppDetected` used to be listed here as a Tier 2 fact authored in 1.4 Resolve, because it
> was raised by reading an included header. #1319 made it **declared** -- it comes from
> `cppRequired` in the config or `--cpp`, and a C++ header met in a run that did not declare
> C++ is E0507 rather than a silent switch. It is therefore not a tier fact in either
> direction: the test above asks whether one file is enough, and the answer is now that
> **no** file is needed. It is a configuration input, known before pass 1.1 opens anything,
> which is why nothing downstream can read it too early.

The AST is Tier 1 with a short lifetime. That resolves the problem of a parse tree that
cannot be serialized, rather than relocating it: pull a serializable `SourceSpan` out and
the tree is confined to a pass whose output is cheap to recompute.

A `SourceSpan` is four integers -- `line`, `column`, `endLine`, `endColumn`. It names no
file, because the symbol or diagnostic carrying it already does. It is Tier 1 with a long
lifetime: computable from one file, and needed everywhere a position is reported, which is
as far as 3.1. Position is the only thing later passes want from a tree, so once a span can
travel on its own, nothing downstream has a reason to hold a node.

**Pass 1.3 consumes `ParsedFile` and does not re-export it.** That single rule is what makes
the lifetime axis enforceable -- the tree is not reachable from any artifact a downstream
pass holds, so a dependency rule is a backstop rather than the primary guard.

### What a symbol carries

#### Tier 1 -- authored in 1.3 Declare

| fact                                             | note                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `kind`                                           | the discriminator; never erased at a layer boundary              |
| `name`                                           | the leaf, as written in its scope                                |
| `fullyQualifiedCName`                            | the identifier C sees                                            |
| `cnxScopedName`                                  | the name the author wrote; what a diagnostic quotes              |
| scope reference                                  | a path or id, never a live object                                |
| `sourceFile`, `sourceLine`, `sourceColumn`       | a symbol-level diagnostic can point as precisely as any other    |
| `sourceLanguage`                                 | C-Next, C or C++                                                 |
| `visibility`                                     | public or private, as declared                                   |
| declared type                                    | structured, never flattened to a string at a boundary            |
| array dimensions                                 | as written; `(number \| string)[]`                               |
| `isConst` (as written), `isAtomic`, `isVolatile` | qualifiers, on every kind that can carry them                    |
| `overflowBehavior`                               | clamp or wrap, so the declared behavior survives a file boundary |
| `initialValue`                                   | initializer source text                                          |
| members as symbols                               | enum members, bitmap fields, register members and struct fields  |
| function parameters, return type                 | ordered, named, typed                                            |
| is-a-callback-type                               | ADR-029 function-as-type, and its typedef name                   |

#### Tier 2 -- authored in 1.4 Resolve

Auto-const; parameter-modified, direct and transitive; pass-by-value eligibility; the call
graph; opaque-vs-defined; symbol conflicts; callback promotion; which C
header declares a type; transitively visible enums from includes; external const values;
external struct fields; resolved array dimensions.

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

[ADR-016](../decisions/adr-016-scope.md) decides no nested scopes for v1. The reason is
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
