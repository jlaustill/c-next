# Unify array dimension resolution

**Date:** 2026-08-23
**Issues:** closes #1127, #1157, #1158
**Branch:** `fix/1127-unify-array-dimension-resolution`
**Status:** Design — awaiting approval

## Problem

"What are this array's dimensions?" is answered independently in six places. Two of
those answers reach the `.c` and the `.h`, and they disagree. Two live bugs result,
both producing C that does not compile.

`#1127` documented the structure and recorded the enum-qualified case as _latent_ —
agreeing today, unenforced. It is no longer latent: the arithmetic branch is broken now.

## Current state

### The six derivations

| #   | Site                                                               | Input  | Serves                          | Capability                                            |
| --- | ------------------------------------------------------------------ | ------ | ------------------------------- | ----------------------------------------------------- |
| 1   | `StructCollector.tryResolveExpressionDimension`                    | AST    | symbol model → `.h` + `.c` body | integer literal or bare const **only**                |
| 2   | `StructCollector.processArrayTypeSyntax`                           | AST    | symbol model                    | reads `dims[0]` **only**                              |
| 3   | `ArrayDimensionParser.parseSingleDimension`                        | AST    | `.c`                            | literals (incl. hex), consts, `CONST±CONST`, `sizeof` |
| 4   | `ArrayDimensionUtils.generateArrayTypeDimension`                   | AST    | `.c` struct fields              | all dimensions, full folding, expression fallback     |
| 5   | `HeaderSymbolAdapter.resolveArrayDimension`                        | string | `.h`                            | enum qualification                                    |
| 6   | `SymbolUtils.parseArrayDimensions` / `TypeResolver.parseArrayType` | string | TType, C declarators            | mutually divergent                                    |

(1) is a strict subset of (3). (6) disagrees with itself.

### The precedence bug

`StructGenerator.generateRegularField` computes the _correct_ dimensions via (4), then
discards them whenever the symbol model has anything at all:

```ts
const fieldDims = getTrackedFieldDimensions(
  input.symbols,
  structName,
  fieldName,
);
if (fieldDims !== undefined) {
  return `    ${type} ${fieldName}${fieldDims.map((d) => `[${d}]`).join("")};`; // model wins
}
if (hasArrayTypeSyntax || isArray) {
  return `    ${type} ${fieldName}${arrayTypeDimStr}${dims};`; // AST, correct
}
```

`getTrackedFieldDimensions` returns `undefined` for an _empty_ list, so the AST path is
reached only when the model holds nothing. That single detail explains both bugs.

### How the two bugs fall out

**#1157 — `u8[8+1] data`.** (1) cannot fold `8+1`, returns `undefined`, the dimension is
dropped while `isArray` stays `true`. The model holds an empty list, so the `.c`
declaration falls through to (4) and is correct; the `.h` and the `.c` body read the
model and are not.

| consumer         | source | output                                 |
| ---------------- | ------ | -------------------------------------- |
| `.c` declaration | (4)    | `uint8_t data[9]`                      |
| `.c` body        | model  | array-ness lost → **bit manipulation** |
| `.h`             | model  | `uint8_t data`                         |

**#1158 — `u8[2][3] cells`.** (2) records only `[2]`. The model is now non-empty, so it
wins, and (4)'s correct `[2][3]` is discarded. Both files emit `uint8_t cells[2]` while
the body still emits `cells[1][2]`.

The grammar is `arrayType : primitiveType arrayTypeDimension+`, so multi-dimensional
arrays are deliberate syntax, and top-level `u8[2][3] grid;` is already correct. This is
a defect, not an unsupported form — no ADR is required.

### Type constraint

`ICodeGenSymbols.structFieldDimensions` is `Map<string, Map<string, readonly number[]>>`.
It cannot represent a macro or enum-qualified dimension at all, which is a second reason
struct fields cannot currently carry the same information variables do.

## Target architecture

One pass decides; two consumers read.

```
Stage 3   collect    record every dimension faithfully
                     number when foldable, raw source text otherwise
                     never drop, never truncate
                        |
Stage 3b  finalize   resolve each remaining string exactly once
                     cross-file consts + qualified enum -> C name
                     walks variables AND struct fields
                        |
             +----------+----------+
             |                     |
Stage 5 .c                    Stage 6 .h
   read the finished dimensions; neither re-derives
```

**Invariant:** after Stage 3b, `arrayDimensions.length` equals the dimension count in the
source, and every entry is either a `number` or a string that is already a valid C
identifier or expression. No consumer performs resolution.

## Detailed design

### Stage 3 — collection records, it does not decide

`StructCollector` stops half-resolving:

- `processArrayTypeSyntax` returns `(number | string)[]` and iterates **every**
  `arrayTypeDimension()`, not `dims[0]`. Fixes #1158.
- `tryResolveExpressionDimension` is **deleted**; its callers use
  `ArrayDimensionParser.parseSingleDimension` — derivation (3), already the strongest.
  Fixes #1157.
- A dimension that still will not fold is recorded as its **raw expression text**
  rather than dropped.
- Unsized `[]` records the empty string `""`, so the dimension keeps its position in the
  list and consumers emit `[]` for it. An empty list therefore means "not an array",
  which is distinct from `[""]` meaning "one unsized dimension" — a distinction the
  current model cannot express.

### Stage 3b — the single finalization point

`SymbolTable.resolveExternalArrayDimensions()` becomes `finalizeArrayDimensions()` and:

- walks struct fields in addition to variables (today it iterates only
  `symbol.kind === "variable"`, which is precisely why top-level `u8[8+1] x;` works and
  the struct field does not);
- keeps the existing cross-file const resolution (#461);
- absorbs the qualified-enum → C name logic currently in
  `HeaderSymbolAdapter.resolveArrayDimension`, which is then **deleted**;
- leaves anything it cannot resolve as text, explicitly, so no consumer silently retries.

Stage 3b operates on symbols and therefore on strings, not AST. Constant folding that
needs the parse tree stays at collection time, where the tree exists; Stage 3b handles
only what is decidable from text plus the symbol table. This split is deliberate and
documented, not a residual second path: collection folds, Stage 3b resolves names.

### Stage 5 / Stage 6 — consumers become dumb

- `structFieldDimensions` widens to `(number | string)[]`.
- `StructGenerator.generateRegularField` reads the model only; the AST fallback branch
  is deleted once the model is guaranteed complete.
- `HeaderSymbolAdapter` maps values to strings with no resolution step.
- `ScopeGenerator` — also a consumer of `ArrayDimensionUtils` — is migrated in the same
  change; leaving it behind would re-create the split.
- **Function-local** array declarations keep `CodeGenerator.generateArrayDimension`.
  Locals have no symbol-table entry, so this is a disjoint domain rather than a second
  path, and will carry a comment saying so.

### Derivation (6) — the string parsers

`SymbolUtils.parseArrayDimensions` and `TypeResolver.parseArrayType` collapse onto one
shared helper using the strict round-trip check (`String(n) === text`), which is the
correct one:

```
"[0x10]"   SymbolUtils "0x10"   TypeResolver 0    <- parseInt("0x10", 10)
"[8+1]"    SymbolUtils "8+1"    TypeResolver 8    <- silently drops "+1"
"[8ul]"    SymbolUtils "8ul"    TypeResolver 8
```

Not currently reachable through codegen, so this is hardening rather than a bug fix, but
it is the same fact derived twice and is in scope under the same rule.

## Behavior changes

| input                              | before                                        | after                |
| ---------------------------------- | --------------------------------------------- | -------------------- |
| `struct { u8[8+1] d; }`            | `.c` `d[9]` + bit-manipulation body; `.h` `d` | `d[9]` everywhere    |
| `struct { u8[2][3] c; }`           | `c[2]` both files; body `c[1][2]`             | `c[2][3]` both files |
| `TypeResolver.resolve("u8[0x10]")` | dimension `0`                                 | dimension `16`       |
| everything else                    | —                                             | unchanged            |

The first two currently produce C that does not compile, so no working program depends
on them. The third is not reachable from codegen today.

## Testing

- **Regression fixtures** in `tests/bugs/issue-1157/` and `tests/bugs/issue-1158/`,
  per project convention, committed with the fix.
- **Execution tests**, not transpile-only — both bugs are miscompiles, so the fixtures
  must compile and run with unique non-zero return codes per assertion.
- **`.c`/`.h` agreement test** covering every dimension shape the grammar permits —
  literal, hex, const, cross-file const, `CONST±CONST`, `sizeof`, scope-local enum,
  `this.`-qualified, `global.`-qualified, multi-dimensional, unsized — asserting the two
  files carry identical dimensions. This is the guard #1127 asks for.
- **Unit tests** for the unified string parser, including the three divergent cases above.
- **Perturbation check** from #1127: change the resolution rule in one place and confirm
  it is impossible to desynchronise the two outputs, because only one place exists.
- Baseline to hold: 222 files / 6034 unit tests, plus `npm run test:all`.

## Risks

1. **Snapshot churn.** Widening `structFieldDimensions` and re-routing struct fields may
   shift `.expected.c`/`.expected.h` output. Every diff must be inspected by hand and
   justified; `--update` is not to be run blind.
2. **The local-declaration carve-out.** `generateArrayDimension` surviving for
   function-locals is the one place two mechanisms remain. It is justified only while
   locals genuinely have no symbol entry — that must be verified, not assumed.
3. **Order dependence.** Stage 3b runs before conflict checking and codegen; adding
   struct-field traversal must not perturb Stage 4.

## Out of scope

- The 138 SonarCloud code smells — deliberately deferred to the follow-up PR so this one
  stays reviewable.
- #1114 (over-indexing a correctly-declared field) — a bounds-checking concern, distinct
  from dimension resolution.
