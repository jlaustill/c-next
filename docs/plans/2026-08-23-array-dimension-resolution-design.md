# Unify array dimension resolution

**Date:** 2026-08-23
**Issues:** closes #1127, #1157, #1158, #1159
**Branch:** `fix/1127-unify-array-dimension-resolution`
**Status:** Design — awaiting approval

## Problem

"What are this array's dimensions?" is answered independently in at least nine places.
Three of those answers reach the `.c`, the `.h`, and the bounds checker, and they
disagree. Three live bugs result: two produce C that does not compile, and one silently
disables ADR-036 bounds checking.

`#1127` documented the structure and recorded the enum-qualified case as _latent_ —
agreeing today, unenforced. It is no longer latent.

## Current state

### The derivations

| #   | Site                                                               | Input  | Serves                          | Capability                                            |
| --- | ------------------------------------------------------------------ | ------ | ------------------------------- | ----------------------------------------------------- |
| 1   | `StructCollector.tryResolveExpressionDimension`                    | AST    | symbol model → `.h` + `.c` body | integer literal or bare const **only**                |
| 2   | `StructCollector.processArrayTypeSyntax`                           | AST    | symbol model                    | reads `dims[0]` **only**                              |
| 3   | `ArrayDimensionParser.parseSingleDimension`                        | AST    | `.c`                            | literals (incl. hex), consts, `CONST±CONST`, `sizeof` |
| 4   | `ArrayDimensionUtils.generateArrayTypeDimension`                   | AST    | `.c` struct fields              | all dimensions, full folding, expression fallback     |
| 5   | `HeaderSymbolAdapter.resolveArrayDimension`                        | string | `.h`                            | enum qualification                                    |
| 6   | `SymbolUtils.parseArrayDimensions` / `TypeResolver.parseArrayType` | string | TType, C declarators            | mutually divergent                                    |
| 7   | `TypeRegistrationEngine._collectArrayDimensions`                   | AST    | `CodeGenState` → bounds checker | `Number.parseInt(text, 10)`                           |
| 8   | `ArrayDimensionParser.parseSimpleDimensions`                       | AST    | type registration               | `Number.parseInt(text, 10)`                           |
| 9   | `FunctionContextManager.parseForParameters`                        | AST    | parameters                      | `Number.parseInt(text, 10)`                           |

(1) is a strict subset of (3). (6) disagrees with itself. (3) and (8) are **methods on the
same class** with different strength.

The bare `Number.parseInt(<dimension text>, 10)` idiom appears at five sites —
`TypeRegistrationEngine.ts:128/:378/:565`, `ArrayDimensionParser.ts:268`,
`FunctionContextManager.ts:404` — and is wrong for every non-decimal form:

```
Number.parseInt("0x10", 10) === 0     // stops at 'x'
Number.parseInt("8+1",  10) === 8     // stops at '+'
Number.parseInt("8ul",  10) === 8     // stops at 'u'
```

`LiteralUtils.parseIntegerLiteral()` already handles all of these correctly and is the
right callee at every one of those sites.

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
reached only when the model holds nothing.

### How the three bugs fall out

**#1157 — `struct { u8[8+1] data; }`.** (1) cannot fold `8+1`, returns `undefined`, the
dimension is dropped while `isArray` stays `true`. The model holds an empty list, so the
`.c` declaration falls through to (4) and is correct; the `.h` and the `.c` body read the
model and are not.

| consumer         | source | output                                 |
| ---------------- | ------ | -------------------------------------- |
| `.c` declaration | (4)    | `uint8_t data[9]`                      |
| `.c` body        | model  | array-ness lost → **bit manipulation** |
| `.h`             | model  | `uint8_t data`                         |

**#1158 — `struct { u8[2][3] cells; }`.** (2) records only `[2]`. The model is now
non-empty, so it wins, and (4)'s correct `[2][3]` is discarded. Both files emit
`uint8_t cells[2]` while the body still emits `cells[1][2]`.

**#1159 — locals.** (7) registers dimensions with `Number.parseInt(text, 10)`, and
`TypeValidator.checkArrayBounds` guards with `dimensions[i] > 0`. A mis-parsed `0`
therefore **skips validation silently**:

```cnx
u8[16]   data;  data[9999] <- 1;   // correctly rejected
u8[0x10] data;  data[9999] <- 1;   // silently accepted -> data[9999] = 1U
```

The same defect rejects valid code in the other direction: `u8[8+1] data; data[8] <- 1;`
fails with `8 >= 8`, a bound that appears nowhere in the source.

### Scope note: locals

Function-local variables are deliberately **not** in `SymbolTable`, and that is correct:
the table exists for cross-file resolution, Stage 4 conflict detection, and header
generation, none of which apply to a local. But locals are not untracked — they carry
type info in `CodeGenState` (`localVariables`, `localArrays`, and the `TTypeInfo`
registered by `TypeRegistrationEngine`), and _that_ is where their dimensions live.

So locals are in scope for this work. An earlier draft of this design carved them out on
the grounds that they had no symbol entry; that was true but irrelevant, because the
mechanism they do have is derivation (7), which is broken.

### Type constraint

`ICodeGenSymbols.structFieldDimensions` is `Map<string, Map<string, readonly number[]>>`
and `TTypeInfo.arrayDimensions` is `number[]`. Neither can represent a macro or
enum-qualified dimension, which is a second reason struct fields and locals cannot carry
the same information variables do.

## Target architecture

One pass decides; every consumer reads.

```
Stage 3   collect    record every dimension faithfully
                     number when foldable, raw source text otherwise
                     never drop, never truncate
                        |
Stage 3b  finalize   resolve each remaining string exactly once
                     cross-file consts + qualified enum -> C name
                     walks variables AND struct fields
                        |
             +----------+-----------+-----------+
             |                      |           |
Stage 5 .c            Stage 6 .h        bounds checker
   read the finished dimensions; none re-derives
```

Function-local declarations have no Stage 3 entry, so they register their dimensions
during Stage 5 — but through the **same evaluator**, not a private one. The rule is not
"one call site"; it is **one evaluator, one decision**, with `LiteralUtils.parseIntegerLiteral`
as the floor beneath all of it.

**Invariant:** after finalization, `arrayDimensions.length` equals the dimension count in
the source, and every entry is either a `number` or a string that is already a valid C
identifier or expression. No consumer performs resolution.

## Detailed design

### Stage 3 — collection records, it does not decide

`StructCollector` stops half-resolving:

- `processArrayTypeSyntax` returns `(number | string)[]` and iterates **every**
  `arrayTypeDimension()`, not `dims[0]`. Fixes #1158.
- `tryResolveExpressionDimension` is **deleted**; its callers use
  `ArrayDimensionParser.parseSingleDimension` — derivation (3), the strongest. Fixes #1157.
- A dimension that still will not fold is recorded as its **raw expression text**
  rather than dropped.
- Unsized `[]` records the empty string `""`, so the dimension keeps its position in the
  list and consumers emit `[]` for it. An empty list therefore means "not an array",
  distinct from `[""]` meaning "one unsized dimension" — a distinction the current model
  cannot express.

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
only what is decidable from text plus the symbol table. This split is deliberate:
collection folds, Stage 3b resolves names.

### The five weak parses

Sites 7, 8 and 9 — the `Number.parseInt(text, 10)` idiom — all route through
`LiteralUtils.parseIntegerLiteral()`. Fixes #1159, and makes `ArrayDimensionParser`
internally consistent by removing the weak sibling of its own strong method.

This is the single highest-value change in the set: it is what restores bounds checking
to hex-sized arrays.

### Consumers become dumb

- `structFieldDimensions` and `TTypeInfo.arrayDimensions` widen to `(number | string)[]`.
- `StructGenerator.generateRegularField` reads the model only; the AST fallback branch
  is deleted once the model is guaranteed complete.
- `HeaderSymbolAdapter` maps values to strings with no resolution step.
- `ScopeGenerator` — also a consumer of `ArrayDimensionUtils` — is migrated in the same
  change; leaving it behind would re-create the split.
- `TypeValidator.checkArrayBounds` keeps its `dimensions[i] > 0` guard for genuinely
  unsized `[]` dimensions, but a **dimension that failed to resolve must no longer be
  representable as `0`** — that conflation is what made #1159 silent.

### Derivation (6) — the string parsers

`SymbolUtils.parseArrayDimensions` and `TypeResolver.parseArrayType` collapse onto one
shared helper using the strict round-trip check (`String(n) === text`):

```
"[0x10]"   SymbolUtils "0x10"   TypeResolver 0    <- parseInt("0x10", 10)
"[8+1]"    SymbolUtils "8+1"    TypeResolver 8    <- silently drops "+1"
"[8ul]"    SymbolUtils "8ul"    TypeResolver 8
```

Not currently reachable through codegen, so this is hardening rather than a bug fix, but
it is the same fact derived twice.

## Behavior changes

| input                              | before                                        | after                |
| ---------------------------------- | --------------------------------------------- | -------------------- |
| `struct { u8[8+1] d; }`            | `.c` `d[9]` + bit-manipulation body; `.h` `d` | `d[9]` everywhere    |
| `struct { u8[2][3] c; }`           | `c[2]` both files; body `c[1][2]`             | `c[2][3]` both files |
| `u8[0x10] d; d[9999] <- 1;`        | **accepted** — bounds check skipped           | rejected             |
| `u8[8+1] d; d[8] <- 1;`            | **rejected** — false `8 >= 8`                 | accepted             |
| `TypeResolver.resolve("u8[0x10]")` | dimension `0`                                 | dimension `16`       |
| everything else                    | —                                             | unchanged            |

Rows 1, 2 and 4 currently produce non-compiling C or refuse valid code, so no working
program depends on them. Row 3 is a **tightening**: code that transpiles today will start
being rejected. That is the point of the fix, but it is the one change that can break a
build, and it must be called out in the PR description and release notes.

## Testing

- **Regression fixtures** in `tests/bugs/issue-1157/`, `issue-1158/`, `issue-1159/`, per
  project convention, committed with the fix.
- **Execution tests**, not transpile-only — #1157 and #1158 are miscompiles, so the
  fixtures must compile and run with unique non-zero return codes per assertion.
- **A `test-error` fixture** for #1159's tightening, with `.expected.error`.
- **Notation-parity test:** `u8[16]` and `u8[0x10]` must produce identical bounds-checking
  behaviour. The silent variant is the dangerous one, so this is the guard that matters most.
- **`.c`/`.h` agreement test** covering every dimension shape the grammar permits —
  literal, hex, const, cross-file const, `CONST±CONST`, `sizeof`, scope-local enum,
  `this.`-qualified, `global.`-qualified, multi-dimensional, unsized — asserting both
  files carry identical dimensions. This is the guard #1127 asks for.
- **Unit tests** for the unified string parser, including the three divergent cases.
- **Perturbation check** from #1127: change the resolution rule in one place and confirm
  the two outputs cannot desynchronise, because only one place exists.
- Baseline to hold: 222 files / 6034 unit tests, plus `npm run test:all`.

## Risks

1. **Snapshot churn.** Widening the dimension types and re-routing struct fields may
   shift `.expected.c`/`.expected.h` output. Every diff inspected by hand and justified;
   `--update` is not to be run blind.
2. **Row 3 is a breaking tightening.** Restoring bounds checking to hex-sized arrays will
   reject code that compiles today. Correct, but it belongs in the release notes.
3. **Order dependence.** Stage 3b runs before conflict checking and codegen; adding
   struct-field traversal must not perturb Stage 4.
4. **Breadth.** Nine derivations across symbols, codegen, headers and validation. If the
   change proves too large to review as one PR, the natural seam is to land the five weak
   parses (#1159) first, since that fix is independent and carries the safety payload.

## Out of scope

- The 138 SonarCloud code smells — deferred to the follow-up PR so this one stays reviewable.
- #1114 (over-indexing a correctly-declared field) — a bounds-checking concern distinct
  from dimension resolution.
