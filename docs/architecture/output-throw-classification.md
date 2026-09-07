# Classification of every `throw new` in `output/`

Deliverable of [#1321](https://github.com/jlaustill/c-next/issues/1321). Resolves open
question 4 of [#1313](https://github.com/jlaustill/c-next/issues/1313) — _"Does Render really
own nothing?"_ — and is the input that splits
[#1322](https://github.com/jlaustill/c-next/issues/1322) into workable pieces.

[`README.md`](README.md) states the rule these sites violate:

> **2.1 authors every rejection.** A diagnostic carries a code and a position, which means it
> cannot originate from a `throw` in a later pass.

A `throw` in `output/` has no position to carry, which is why a fixture reports `1:0`.

## Counts

## How to recount

Run these rather than restating the numbers below; a count in prose is the thing that goes
stale, and this document has done it before.

```bash
# every throw STATEMENT in output/ -- the corpus this audit classifies (184)
grep -rn '^\s*throw\b' src/transpiler/output --include='*.ts' | grep -v __tests__ | wc -l
# the subset spelled `throw new` (181)
grep -rn '^\s*throw new' src/transpiler/output --include='*.ts' | grep -v __tests__ | wc -l
# and the authority: the gate agrees or fails
npm run docs:throw-citations:check
```

Measured on `fix/1322-diagnostics-into-pass-2-1` @ `8477f526`.

#1321 was filed against 177 and this audit first recorded 181, counting `throw new` only: 180
`Error` plus one `TypeError` in `StringHandlers`.

**That definition was too narrow, and the gate shared the blind spot (#1322).** A throw need not
say `new`. `helpers/CodeGenErrors.ts` builds seven `Error`s with `return new Error(...)` and its
callers write `throw CodeGenErrors.x(...)`, so **three further sites** were classified nowhere and
demanded by nothing — invisible in both directions, because a site the gate does not count is also
a site it never asks for a row for. One of them, `subscript/SubscriptDepthValidator.ts:109`, carries
**E0856**: registered in `docs/error-codes.md` and asserted by two fixtures under
`tests/bit-indexing/`. A user-facing, coded, fixture-covered diagnostic sat outside the audit that
exists to find exactly those.

So the corpus was **184** when the gate was widened, and is **145** now that `ArrayAccessHelper`, `CodeGenErrors`, all 23 bucket-3 sites and all 16 invariants are gone. What remains is bucket 1 exactly. What this cost the anchors is the argument against the indirection, and it has now been paid: a
factory throw's argument list is `(line, varName, …)`, not the message, so those rows had to be
anchored on their **arguments** — the only honest key for a site whose text is written elsewhere.
`CodeGenErrors` is deleted and E0856 is raised at its site, so its row is anchored on what it
says, like every other.

The number grows with ordinary work, which is why the acceptance criterion should read "every site
as counted at audit time" rather than a literal.

| bucket | meaning                                                                        | count  |
| ------ | ------------------------------------------------------------------------------ | ------ |
| **1**  | user-facing diagnostic — belongs in pass 2.1, needs a code and a real position | **27** |
| **2**  | internal invariant — should never fire for valid input; becomes an assertion   | **0**  |
| **3**  | dead — unreachable or subsumed; delete                                         | **0**  |
|        | **total**                                                                      | **27** |

**80% of `output/`'s throws are rejections.** That is the answer to open question 4: Render does
not own nothing, it currently owns almost all of the rejection surface.

By area:

| area                                                                | sites | b1  | b2  | b3  |
| ------------------------------------------------------------------- | ----- | --- | --- | --- |
| `codegen/` (root: `CodeGenerator`, `TypeValidator`, `TypeResolver`) | 8     | 8   | 0   | 0   |
| `codegen/helpers/`                                                  | 3     | 3   | 0   | 0   |
| `codegen/generators/**`                                             | 12    | 12  | 0   | 0   |
| `codegen/subscript/`                                                | 1     | 1   | 0   | 0   |
| `codegen/assignment/**`, `codegen/resolution/`, `headers/`          | 3     | 3   | 0   | 0   |

## Position availability — the finding that shapes #1322

**32 of 184 sites already hold the line; 20 of them let the user see it.** An earlier version of
this section said "only 2 of 181", which is wrong by an order of magnitude and sized tier A far too
small. Measured mechanically -- a throw's statement is collected to its terminating `;` and matched
for an interpolated line:

| what the message does with the line                     | sites   | reaches the user?                                                   |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| opens with a `${line}:${col} ` prefix                   | **20**  | yes -- `ParserUtils.parseErrorLocation` scrapes the prefix back out |
| names the line in prose (`Error at line 45:`, `Line 7`) | **12**  | no -- the number is computed and then spent on text                 |
| carries no line at all                                  | **152** | no -- `parseErrorLocation` falls back to `1:0`                      |

The 20 are the reason the corpus is not uniformly `1:0`: 176 of 312 `.expected.error` fixtures
carry a real position. The 12 are tier A's core -- the position is in hand and thrown away, so
relocating them adds no plumbing.

Both forms are hacks around the same absence. A prefix parsed back out of a message is a position
smuggled through a channel that does not carry one, which is precisely what a coded diagnostic in
2.1 makes unnecessary.

Sites divide into three tiers, and the tiers are the natural work split:

| tier  | situation                                                                                           | sites                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | position already computed, then spent on prose (`Error at line 45:`, `Line 7`) or a hard-coded `:0` | the 12 prose-line sites above (`ScopeGenerator`, `IncludeGenerator` ×2, `PostfixExpressionGenerator`'s bitmap bracket-indexing throw, `VariableModifierBuilder`, `VariableDeclHelper` ×2, `TypeValidator` ×5) plus the 13 `ArrayHandlers` slice sites    |
| **B** | an AST node is in scope and simply unused                                                           | every `assignment/handlers/` site (`ctx.statementCtx` / `targetCtx` / `valueCtx` / `subscripts[]`), plus `TypeValidator` and most of `CodeGenerator`                                                                                                     |
| **C** | no AST node anywhere; must be threaded from callers                                                 | `ScopeResolver` (string-only signature, 4+ callers), `SizeofResolver`, `codegen/TypeResolver`, most of `PostfixExpressionGenerator` (`IPostfixContext`, `IExplicitLengthContext`, `IMemberAccessContext` and `IFloatBitRangeContext` carry only strings) |

`ISubscriptAccessContext` is the sole context interface that already carries its node (`op:
PostfixOpContext`) and is the model for tier C.

## Duplicate messages — text cannot identify a site

Several messages are byte-identical across throw sites, so any fixture-to-site mapping done by
grepping message text is **wrong**. The `assignment/` audit established attribution by proxying
`Error` construction and reading the constructing stack frame instead.

Sites are named by file and message rather than by line: a line number here is a second,
ungated copy of what the classification rows already hold, and this table's previous version
had drifted (invariant 5, #1322).

**Measured after 1322a**, by collecting each throw's statement to its terminating `;` and
grouping on the result:

**None remain.** The last group -- three copies of
`Error: Cannot assign non-enum value to ${typeName} enum` in
`EnumAssignmentValidator` -- went with the ADR-017 relocation. They were never
three rules: each was reached by a different shape of dotted source text after
the split failed to prove the value was an enum, and asking one question about a
resolved type leaves one site.

The first row was **9** before 1322a: four copies were bucket-3 deletions and the ninth was
`CodeGenErrors.scopedTypeOutsideScope`, a factory with no caller at all. Deleting the dead
copies first is what makes unification tractable, and is the argument for that ordering.

Three groups here were **absent from this table's previous version** — the four
`EnumAssignmentValidator` copies, the three `E0853` arms (since relocated) and the const-constructor pair — and
one it listed (`Cannot reference own scope`) is not byte-identical after all. The table was
written by reading; this one is generated by measuring, which is why it disagrees.

Relocating these to 2.1 must **unify each into one decision point**, not port N copies
(`CLAUDE.md`, no duplicate code paths).

Each citation row therefore carries an **`anchor`** beside its `file:line`: a verbatim
substring of the throw's argument, at least eight characters, which the gate holds to the
statement at the cited line. The line stays the key and the anchor corroborates it — two rows
cannot trade line numbers between sites that say different things and stay green, which is the
shape #1322's delete work produces ([#1374](https://github.com/jlaustill/c-next/issues/1374)).
Sites with identical messages carry identical anchors and remain interchangeable, the limitation
the table above records. The gate also checks the property directly: no two rows in one file may
carry anchors that each match the other's throw, so an anchor that stops just short of the text
telling two different throws apart is reported, not left to review. When a row drifts, its anchor
also says which throw it meant, so correcting the line is a lookup rather than a guess.

## Bucket 2 — internal invariants (0)

**All 16 are resolved (#1322b).** Each is now an `invariant(condition, statement)` assertion,
so it no longer opens with `throw new` and has left this corpus.

The conversion did three things beyond changing the spelling.

It **normalized the family**. Six declaration-generator guards said the same thing two ways:
four opened `Internal: no 'scope' declaration generator is registered`, two said
`Error: struct generator not registered`. A reader could not tell an invariant from a user
diagnostic by looking, and neither could this document — which is how two of them came to be
classified alongside rejections in the first place.

It **states the guarantee rather than the symptom**. `registerDeclaration("scope") is
unconditional in the constructor` says what is promised; `no 'scope' declaration generator is
registered` says only what was observed. The reader of a crash report needs the first — the
stack trace already carries the second.

And it **keeps the narrowing**. `invariant` is an `asserts condition` function, which is what
lets an unreachable guard be converted without the following line losing its type. One site
needed splitting in two: `asserts` narrows a reference, not an arbitrary expression, so
asserting `fields?.has(name)` leaves `fields` itself possibly-undefined.

## Bucket 3 — dead (0)

**All 23 are resolved (#1322a).** Seventeen were deleted; four were not dead at all and are
recorded below. The table is empty rather than removed: the section is what a later reader
checks to see whether the audit's third bucket was ever discharged.

### Four were misclassified, and the mistake is instructive

`StringHandlers`' guards on `structTypeInfo`, `fieldType` and `dimensions` were classified
`dead — delete`. They are genuinely unreachable, exactly as the evidence said. They are also
**load-bearing for the type system**: deleting them yields `TS18048: possibly 'undefined'` on
the next line, because each guard narrows the value the following statement uses.

Unreachable AND load-bearing is not dead. It is an internal invariant, so those four became
`invariant(...)` assertions — which keep the narrowing, name the guarantee, and mark the
failure `Internal:` so it is not read as a user diagnostic. The audit's evidence was right and
its verdict was wrong, because "can this fire?" and "can this be removed?" are different
questions and only the first was asked.

### What the deletions removed

- `TypeValidator.validateBareIdentifierInScope` (6 throws) — zero production callers since
  ADR-057 gave bare identifiers a resolver that resolves rather than throws.
- `TypeGenerationHelper.generateArrayBaseType` (1) and `CastValidator.validateIntegerCast` (2)
  — no callers; the cast pair duplicated live inline logic in `CodeGenerator` message for message.
- `StringDeclHelper`'s C-style string-array path (3) — `_generateStringArrayDecl` and its two
  helpers. Verified by probe, not by reading: all three routes in (`string<8> items[3]`,
  `items[]`, and the fill-all form) are intercepted by
  `VariableDeclHelper.validateArrayDeclarationSyntax` with the C-style-array error.
- `EnumAssignmentValidator.validateGlobalEnumPattern` (1) — its only rejection was unreachable,
  and with the throw gone the method did nothing.
- Four copies of `'this' can only be used inside a scope` (`StringHandlers`,
  `AssignmentHandlerUtils` — with the wrapper and both call sites —, `AccessPatternHandlers`,
  `BitmapHandlers`). Stronger than the recorded reproduction: `this.x <- 5` at file scope is a
  **parse error**, so it never reaches codegen at all. That leaves four live copies plus the
  factory, which is what makes unification tractable.

## Bucket 1 — user-facing diagnostics (27)

Each needs a code and a real position in pass 2.1. `code` is the code it already carries, or
**NEW** where one must be allocated. `position` names the node that is or would be in scope.

### `codegen/` root — 8

| file:line               | anchor                                            | message                                                           | code      | position source                                                     | fixture                                |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | --------- | ------------------------------------------------------------------- | -------------------------------------- |
| `TypeValidator.ts:55`   | `E0503: Cannot #include implementation file`      | cannot `#include` an implementation file (ADR-010)                | E0503     | `includeDir` (`IncludeDirectiveContext`) at `CodeGenerator.ts:2367` | `preprocessor/include-impl-file-error` |
| `TypeValidator.ts:126`  | `E0504: Found #include "`                         | `#include "p"` but `p.cnx` exists alongside                       | E0504     | same `includeDir`, `CodeGenerator.ts:2376`                          | `include/cnx-alternative-error-quoted` |
| `TypeValidator.ts:143`  | `E0504: Found #include <`                         | angle-include twin of the above                                   | E0504     | same                                                                | `include/cnx-alternative-error-angle`  |
| `TypeValidator.ts:174`  | `maximum of`                                      | value exceeds W-bit bitmap field maximum (ADR-034)                | NEW E08xx | `expr` (`ExpressionContext`, a parameter)                           | `bitmap/bitmap-error-overflow`         |
| `TypeValidator.ts:213`  | `Error: Function`                                 | function signature does not match callback type                   | NEW       | `valueExpr.start`                                                   | none                                   |
| `TypeValidator.ts:222`  | `to callback field`                               | cannot assign function to callback field (ADR-029 nominal typing) | NEW       | `valueExpr.start`                                                   | `callbacks/callback-error-nominal`     |
| `CodeGenerator.ts:3568` | `Redundant type`                                  | redundant type in struct initializer (ADR-014)                    | NEW E03xx | `explicit.symbol` / `ctx.start`                                     | `structs/struct-redundant-type-error`  |
| `CodeGenerator.ts:3576` | `Cannot infer struct type - no explicit type and` | cannot infer struct type — **fires on valid code, see #1277**     | NEW E03xx | `ctx.start` (`StructInitializerContext`)                            | none                                   |

**13 of these 39 already carry a code**; 26 need one. **12 have no fixture at all.** Three emit a
real position today -- the `${line}:${col} `-prefixed rows in the table below.

### `codegen/helpers/` — 3

**Zero carry a code today.** 25 of the 39 have no fixture.

| file:line                       | anchor                                      | message                                    | code      | position source                                                      | fixture                                 |
| ------------------------------- | ------------------------------------------- | ------------------------------------------ | --------- | -------------------------------------------------------------------- | --------------------------------------- |
| `TypeGenerationHelper.ts:70`    | `Cannot use 'this.Type' outside of a scope` | `this.Type` outside a scope                | NEW E0426 | thread `accessors.scopedType()!.start` from `dispatchTypeGeneration` | none                                    |
| `VariableModifierBuilder.ts:82` | `Cannot use both 'atomic' and 'volatile`    | both `atomic` and `volatile`               | NEW       | `ctx.start` — line already read, column discarded                    | `atomic/atomic-volatile-error`          |
| `VariableDeclHelper.ts:231`     | `Error: C++ class`                          | C++ class with constructor at global scope | NEW       | `typeCtx.start` (in scope)                                           | `external-types/cpp-class-global-error` |

### `codegen/generators/**` — 12

| file:line                               | anchor                                           | message                                                                                       | code      | position source                                                                                              | fixture                                |
| --------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `support/IncludeGenerator.ts:54`        | `Error: Included C-Next file not found`          | included C-Next file not found                                                                | NEW E0506 | `includeDir` at `CodeGenerator.ts:2367`; `.start.line` read at `:2488` but not threaded                      | none                                   |
| `support/IncludeGenerator.ts:111`       | `E0501: Function-like macro`                     | function-like macro not allowed                                                               | E0501     | `ctx` (`DefineDirectiveContext`) — line read, appended as `Line 7` prose                                     | `preprocessor/function-macro-error`    |
| `support/IncludeGenerator.ts:121`       | `E0502: #define with value`                      | `#define` with value not allowed                                                              | E0502     | same prose defect                                                                                            | `preprocessor/value-define-error`      |
| `expressions/BitmapAccessHelper.ts:49`  | `Error: Unknown bitmap field`                    | unknown bitmap field                                                                          | NEW E0426 | none — `IMemberAccessContext` carries no node; thread the owning `PostfixOpContext`                          | none                                   |
| `expressions/AccessExprGenerator.ts:31` | `Error: .capacity is only available on string`   | `.capacity` only on string types — **also fires when it _is_ a string with unknown capacity** | NEW E06xx | thread `PostfixOpContext` from `PostfixExpressionGenerator.ts:657`                                           | none                                   |
| `expressions/AccessExprGenerator.ts:46` | `Error: .size is only available on string types` | `.size` only on string types                                                                  | NEW E06xx | same, from `:672`                                                                                            | none                                   |
| `expressions/CallExprGenerator.ts:370`  | `requires exactly 4 arguments: output`           | `safe_div`/`safe_mod` needs exactly 4 arguments (ADR-051)                                     | NEW       | `argExprs[0].start`, or `ArgumentListContext` at `:268`                                                      | none                                   |
| `expressions/CallExprGenerator.ts:378`  | `requires a variable as the first argument`      | first argument must be a variable (output parameter)                                          | NEW       | `argExprs[0].start`                                                                                          | none                                   |
| `expressions/CallExprGenerator.ts:386`  | `Cannot determine type of output parameter`      | cannot determine output parameter type — **really an undeclared identifier**                  | NEW       | `argExprs[0].start`                                                                                          | none                                   |
| `…/PostfixExpressionGenerator.ts:626`   | `is deprecated. Use explicit properties`         | `.length` deprecated (ADR-058)                                                                | NEW E06xx | `PostfixOpContext` not threaded                                                                              | `errors/length-property-deprecated`    |
| `…/PostfixExpressionGenerator.ts:1726`  | `Cannot use bracket indexing on bitmap type`     | bracket indexing on a bitmap (ADR-034)                                                        | NEW       | **`ctx.op.start` available and already read**, spent on `Error at line 45:` prose — cheapest site to convert | `bitmap/bitmap-bracket-indexing-error` |
| `…/PostfixExpressionGenerator.ts:1943`  | `Float bit indexing reads`                       | float bit-range read at global scope                                                          | NEW E08xx | `IFloatBitRangeContext` carries no node; the subscript `op` is available upstream                            | none                                   |

**32 of the 41 in this area are unpinned**, including all 23 ADR-058 property diagnostics except
`:623`, the ADR-013 const rule, and all four `safe_div`/`safe_mod` checks.

Five sites — one in `CallExprGenerator` and four in `PostfixExpressionGenerator` (their rows are
the ones whose message names a property on an identifier that was never declared) —
fire on an **undeclared identifier**, not on property misuse. The honest fix is one
undefined-identifier diagnostic in symbol resolution; allocating five per-property codes would
bake in a wrong diagnosis.

### `codegen/assignment/**`, `codegen/resolution/`, `headers/` — 3

Attribution here was established by proxying `Error` construction and reading the constructing
stack frame, not by matching message text — necessary because three messages in this area are
byte-identical across sites.

| file:line                           | anchor                                          | message                                          | code  | position source                                                   | fixture                        |
| ----------------------------------- | ----------------------------------------------- | ------------------------------------------------ | ----- | ----------------------------------------------------------------- | ------------------------------ |
| `headers/BaseHeaderGenerator.ts:79` | `is a typedef of a pointer declared in another` | typedef of a pointer declared in another header  | E0505 | `origin.sourceLine` (`IHeaderSymbol`) — no parse tree exists      | none                           |
| `resolution/SizeofResolver.ts:154`  | `Error[E0601]: sizeof() on array parameter`     | `sizeof()` on an array parameter (ADR-023)       | E0601 | none in `throwArrayParamSizeofError(varName)`; thread from `:172` | `sizeof/array-param-error` +1  |
| `resolution/SizeofResolver.ts:178`  | `Error[E0602]: sizeof() operand must not have`  | `sizeof()` operand has side effects (MISRA 13.6) | E0602 | `expr` **is already the parameter** — position available, unused  | `sizeof/side-effects-error` +1 |

The 13 `ArrayHandlers` slice sites **already smuggle a position through the message string** as a
`${line}:0` prefix that a downstream layer parses — which is why
`slice-assignment/slice-runtime-offsets.expected.error` reads `12:0` while most others read `1:0`.
The line is real, the column is a hard-coded `0`, and the mechanism is string formatting rather
than a carried node. Moving these to 2.1 **replaces an existing hack** rather than adding
positions where none exist.

### `codegen/subscript/` — 1

| file:line                                  | anchor                   | message                                         | code      | position source                                                              | fixture                                                                         |
| ------------------------------------------ | ------------------------ | ----------------------------------------------- | --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `subscript/SubscriptDepthValidator.ts:109` | `too many subscripts on` | too many subscripts on a base (ADR-036/ADR-007) | **E0856** | `line` is already a parameter and is spent on `Error at line ${line}:` prose | `bit-indexing/scalar-over-subscript`, `bit-indexing/scalar-over-subscript-this` |

**This row is why the gate was widened.** E0856 is registered, fixture-covered and user-facing, and
it was absent from this audit because the throw named a factory rather than `new`. That indirection
is gone: `helpers/CodeGenErrors.ts` is deleted and the message is built at the site, so the row is
anchored on what the throw says. It remains tier A — the line is a parameter already, spent on
`Error at line ${line}:` prose.

## Proposed split of #1322

The last acceptance criterion of #1321 is that the relocation card becomes workable pieces. The
position tiers above give the split, ordered so each piece is independently mergeable:

| piece              | scope                                                                                                       | why it is separable                                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1322a — delete** | **done** — 17 deleted, 4 reclassified as invariants                                                         | no diagnostic changes; pure removal, and it shrinks every later piece. `CastValidator`'s pair also retires a duplicate code path. `ArrayAccessHelper` and its two types are already gone -- a wholly dead module with zero production importers, whose two throws duplicated live sites in `PostfixExpressionGenerator` |
| **1322b — assert** | **done** — the 16 bucket-2 sites                                                                            | converts to assertions and normalizes the `Error:`/`Internal:` split; no user-visible behavior                                                                                                                                                                                                                          |
| **1322c — tier A** | the 32 sites that already hold the line — 12 spending it on prose, 20 smuggling it through a message prefix | the position exists; this is moving it from the message into the diagnostic. Includes all 13 slice sites, which replaces the string-prefix hack                                                                                                                                                                         |
| **1322d — tier B** | the `assignment/handlers/` and `TypeValidator` sites with a node in scope                                   | mechanical: read `ctx.*.start` instead of discarding it                                                                                                                                                                                                                                                                 |
| **1322e — tier C** | sites with no node, needing threading from callers                                                          | the real work: `ScopeResolver`, `SizeofResolver`, `TypeResolver`, and the `PostfixExpressionGenerator` context interfaces                                                                                                                                                                                               |
| **1322f — unify**  | the 5 duplicated messages, notably the 9-way `'this' can only be used inside a scope`                       | must land as one decision point, not N ported copies. **Not a final phase**: relocating a family and then merging the copies _is_ the N-ported-copies state, so unification is a constraint on every relocation commit — a family leaves `output/` whole or not at all                                                  |

Piece **1322e** should also resolve the five sites that report a property error for what is
actually an undeclared identifier, rather than allocating codes that record the wrong diagnosis.

## Cross-references

- **#1361 — fixed.** `ArrayInitHelper` and `StringDeclHelper`'s `Array size mismatch` throws
  appeared fixture-covered by
  `tests/string-array-init/string-array-init-error-mismatch.expected.error`, which had no
  `.test.cnx` and could never run. The fixture is written and
  `diagnostics:manifest:check` now fails on any orphaned assertion.
- **#1277** — `CodeGenerator`'s `Cannot infer struct type` throw fires on valid C-Next
  (`return { x: 1, y: 2 };` from a struct-returning function). Being fixed in this card: the
  literal types from the declared return type and the throw disappears.
- **ADR-022's nesting rule was enforced on two of a ternary's three children.**
  `validateNoNestedTernary` was called on the true and false branches and never
  on the condition, so `(((n = 1) ? 2 : 3) = 2) ? 4 : 5` compiled and emitted C.
  E0701 does not catch it either: the condition as a whole _is_ a comparison,
  which is what E0701 asks for. Found while relocating the family — the check
  that replaced it reads the parse tree, and writing down which children it
  visits is what exposed the missing one. A corpus scan of 1276 `.cnx` files
  found zero conditions containing a ternary, so closing the hole regressed
  nothing. Same shape as the E0853 `switch` miss: a rule stated once and
  implemented over an enumerated subset of the places it applies.
- **Struct fields of a scope-declared struct resolved to nothing, in four
  analyzers at once.** `ICodeGenSymbols.structFields` is keyed by the transpiled
  C name, so `S.Cfg` at a declaration is `S__Cfg` in the map. Every chain-
  following analyzer passed the source spelling, missed, and treated the chain as
  unresolvable -- and an unresolvable operand is correctly never rejected, so the
  rules simply went quiet. MISRA C:2012 Rule 10.1 fired on a global struct's
  `bool` field and not on a scope-declared struct's; the divide-by-zero,
  array-index and essential-category rules followed the same chains and had the
  same silence. The key is now derived once, inside the lookup, so the fifth
  caller inherits it. `CompoundAssignmentAnalyzer` had been forced to spell the
  derivation out privately, which is the duplicate-path shape; that copy is gone.
  Found while relocating the enum type-safety family, which needs the same chain
  resolution and would have inherited the same hole.
- **ADR-017's enum rules were enforced on four value shapes and silent on the
  rest.** The check split the value's SOURCE TEXT on `.` and matched the pieces
  against patterns, so a bool, an f32, a call returning a non-enum, and
  `1 + 1` were all assignable to an enum and emitted C. The last is the sharpest:
  the ADR lists `s <- 1;` as an error, and the only reason `1 + 1` was not one is
  that the pattern wanted a bare integer literal while constant folding happens
  later, in codegen -- it emitted `State d = 2;`. Resolving the value's declared
  type closes all four at once, because they were never four cases.
  Verified against the corpus: 1182 fixtures, none of which relied on the gap.
- **The twelve slice checks became ASSERTIONS rather than disappearing.** Every
  other family in this card deletes its `output/` copy outright, because the
  check was the only thing standing between the author and a diagnostic. These
  twelve are different: they sit inside the code that EMITS the unrolled copy
  and share its arithmetic -- the element stride, the element count, the
  capacity -- so 2.1 must recompute what 2.3 also needs. If the two ever
  disagree, deleting the checks would turn a rejection into wrong generated C.
  They are `invariant()` calls now, each naming the E08xx code that owns the
  case, so a divergence fails loudly instead. That is not a duplicate decision:
  2.1 decides "reject", 2.3 decides "emit", and the assertion is the tripwire
  between them. It fired for real during this work -- a slice whose buffer was
  declared in an INCLUDED file resolved to nothing in the lexical frames, so 2.1
  passed it over and the assertion caught it instead of the buffer overflowing.
- **The switch family needed no fact codegen had and 2.1 lacked.** Five throws,
  every one reported as `1:0`, and seven fixtures asserting that position
  verbatim. `knownEnums` and `enumMembers` are on the per-file symbol view that
  is populated before `runAnalyzers`; the clause count, the case labels and the
  `default(N)` count are all in the parse tree. They lived in `TypeValidator`
  because that is where the switch was being WRITTEN, not because that is where
  the facts were -- which is worth recording, because it is the cheapest kind of
  relocation in this audit and there are likely more of them.
- **A unit test was pinned to the `1:0` defect.** `Transpiler.test.ts`'s
  "defaults to line 1 for errors without location info" proved the fallback by
  transpiling `u32 r <- (x) ? 1 : 0;` and asserting the result came back at
  `1:0` -- which worked only because ADR-022's controlling-expression rule threw
  from codegen with no position. It broke the moment that rule moved. The
  fallback is still real (98 throws have no position yet), so it is asserted
  against `ParserUtils.parseErrorLocation` directly now, with a companion case
  proving the parser does NOT always answer `1:0`. It no longer depends on which
  diagnostic happens to lack a position, and when the last throw is relocated it
  becomes dead and goes with it.
- **Three string messages were one rule, and a fourth message was wrong.** At
  file scope a string may be initialized by a LITERAL and by nothing else -- C
  cannot run `strncpy` or `strncat` before `main` -- so a copy from a variable,
  a concatenation and a substring extraction all threw, with three different
  messages, from three different generation paths. Asked once about the
  initializer's FORM, they collapse. Separately, `String array initialization
from variables not supported` was misleading: a LIST whose elements are
  variables is a perfectly good array initializer, and what is rejected is an
  initializer that is not a list at all. The first fixture written to the old
  wording used `[a, a]` and did not fire, which is how the wording was caught.
- **Four of `PostfixExpressionGenerator`'s length-property throws were never
  diagnostics.** `Cannot determine .X for '<name>' - type not found in
registry` appears once per property, and the audit classed all four as
  user-facing. An undeclared name is E0427 in pass 2.1 before codegen runs --
  probed: `undeclaredName.bit_length` reports E0427 at a real position -- so what
  is left is a DECLARED name whose type codegen cannot find, which is the
  transpiler being wrong, not the program. They are invariants, which is what
  the plan's tier-C note predicted for the "wrong diagnosis" sites.
- **ADR-058 is `Implemented` and the transpiler rejects what it documents.** The
  ADR's property table gives structs `.bit_length`, `.byte_length` and
  `.element_count`, with a worked `SensorReading` example. Codegen rejected all
  three, and the relocation preserves that -- closing the divergence means
  choosing what `.byte_length` on a struct MEANS, and the ADR says "with
  padding" without saying whose. That is an ABI question the ADR does not
  answer, so it is raised rather than decided here.
- **ADR-024 was one rule reached three ways, and two of the ways carried a
  position by smuggling.** Six rules in `TypeResolver` and `CodeGenerator`, fed
  by a declaration's initializer, an assignment, or a cast -- and on the first
  two paths a rethrow wrapper (`IntegerLiteralValidator`, `AssignmentValidator`)
  caught the message and prefixed `${line}:${col}` onto it. That is why the
  assignment fixtures already showed a real position while the identical cast
  rule showed `1:0`. Relocating it found the codegen paths had DIVERGED: the
  declaration path typed a composite source and the assignment path did not
  (`u8 s <- large + 1` rejected, `cells[0] <- large + 1` accepted); the
  assignment path checked against the ROOT variable's type, so a u32 into a u8
  FIELD reached through a chain was never checked; and inside a scope the
  `this.` spelling was untyped, so `u8 narrow <- this.wide` was accepted. Twelve
  fixtures assert the first two, so both are reproduced in 2.1 -- in one flag
  and one lookup, stated, not two rules -- and raised for a decision. No fixture
  depended on the third, so it is closed.
- **A duplicate the duplicate-message table missed.**
  `ScopeResolver.validateCrossScopeVisibility` and
  `MemberAccessValidator.validateNotSelfScopeReference` both rejected a scope's
  own member reached through the scope's name, with the same words, decided in
  two places -- and the table above grouped by throw text, which one of the two
  prefixed with `Error:` and the other did not. ADR-016's access rules are
  E0435-E0437 in pass 2.1, one decision each, asked once for the three
  syntactic positions a `Scope.member` can stand in (an expression, an
  assignment target, a type). Two codegen exemptions are reproduced rather than
  closed: a register declared in a scope bypasses all three rules, and a struct
  member's qualified type was never visibility-checked -- `S.onTick handler;`
  with a private `onTick` compiles, and #1205's fixture depends on it.
- **#1014–#1017 — resolved by deletion.** `StringDeclHelper`'s C-style string-array path was
  dead only while trailing brackets are rejected unconditionally. They are, verified by probe
  on all three routes in, so the path is gone (1322a) and the conditional dependency with it.
