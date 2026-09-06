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

| bucket | meaning                                                                        | count   |
| ------ | ------------------------------------------------------------------------------ | ------- |
| **1**  | user-facing diagnostic — belongs in pass 2.1, needs a code and a real position | **141** |
| **2**  | internal invariant — should never fire for valid input; becomes an assertion   | **0**   |
| **3**  | dead — unreachable or subsumed; delete                                         | **0**   |
|        | **total**                                                                      | **141** |

**80% of `output/`'s throws are rejections.** That is the answer to open question 4: Render does
not own nothing, it currently owns almost all of the rejection surface.

By area:

| area                                                                | sites | b1  | b2  | b3  |
| ------------------------------------------------------------------- | ----- | --- | --- | --- |
| `codegen/` (root: `CodeGenerator`, `TypeValidator`, `TypeResolver`) | 38    | 38  | 0   | 0   |
| `codegen/helpers/`                                                  | 38    | 38  | 0   | 0   |
| `codegen/generators/**`                                             | 39    | 39  | 0   | 0   |
| `codegen/subscript/`                                                | 1     | 1   | 0   | 0   |
| `codegen/assignment/**`, `codegen/resolution/`, `headers/`          | 25    | 25  | 0   | 0   |

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

| message                                                                  | copies | where                                            |
| ------------------------------------------------------------------------ | ------ | ------------------------------------------------ |
| `Error: Cannot assign non-enum value to ${typeName} enum`                | **4**  | `EnumAssignmentValidator`, all four in one class |
| `E0853: Cannot use 'return' inside critical section`                     | **3**  | `TypeValidator`, three arms of one rule          |
| `Compound assignment operators not supported for bit field access`       | **2**  | `AccessPatternHandlers`, `BitAccessHandlers`     |
| `Error at line ${line}: Constructor argument '${argName}' must be const` | **2**  | `ScopeGenerator`, `VariableDeclHelper`           |

The first row was **9** before 1322a: four copies were bucket-3 deletions and the ninth was
`CodeGenErrors.scopedTypeOutsideScope`, a factory with no caller at all. Deleting the dead
copies first is what makes unification tractable, and is the argument for that ordering.

Three groups here were **absent from this table's previous version** — the four
`EnumAssignmentValidator` copies, the three `E0853` arms, and the const-constructor pair — and
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

## Bucket 1 — user-facing diagnostics (141)

Each needs a code and a real position in pass 2.1. `code` is the code it already carries, or
**NEW** where one must be allocated. `position` names the node that is or would be in scope.

### `codegen/` root — 38

| file:line               | anchor                                            | message                                                           | code                     | position source                                                                                | fixture                                            |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `TypeValidator.ts:58`   | `E0503: Cannot #include implementation file`      | cannot `#include` an implementation file (ADR-010)                | E0503                    | `includeDir` (`IncludeDirectiveContext`) at `CodeGenerator.ts:2478`                            | `preprocessor/include-impl-file-error`             |
| `TypeValidator.ts:129`  | `E0504: Found #include "`                         | `#include "p"` but `p.cnx` exists alongside                       | E0504                    | same `includeDir`, `CodeGenerator.ts:2487`                                                     | `include/cnx-alternative-error-quoted`             |
| `TypeValidator.ts:146`  | `E0504: Found #include <`                         | angle-include twin of the above                                   | E0504                    | same                                                                                           | `include/cnx-alternative-error-angle`              |
| `TypeValidator.ts:177`  | `maximum of`                                      | value exceeds W-bit bitmap field maximum (ADR-034)                | NEW E08xx                | `expr` (`ExpressionContext`, a parameter)                                                      | `bitmap/bitmap-error-overflow`                     |
| `TypeValidator.ts:237`  | `is negative for`                                 | array index is negative                                           | NEW — **E0854 reserved** | `indexExprs[i].start`                                                                          | none                                               |
| `TypeValidator.ts:245`  | `Array index out of bounds`                       | array index `N >= D`                                              | NEW — E0854              | `indexExprs[i].start`                                                                          | `array-initializers/bounds-error` +3               |
| `TypeValidator.ts:276`  | `Error: Function`                                 | function signature does not match callback type                   | NEW                      | `valueExpr.start`                                                                              | none                                               |
| `TypeValidator.ts:285`  | `to callback field`                               | cannot assign function to callback field (ADR-029 nominal typing) | NEW                      | `valueExpr.start`                                                                              | `callbacks/callback-error-nominal`                 |
| `TypeValidator.ts:482`  | `E0853: Cannot use 'return' inside critical`      | `return` inside `critical` (ADR-050)                              | E0853                    | `stmt.returnStatement()!.start`                                                                | `critical/return-error`                            |
| `TypeValidator.ts:503`  | `E0853: Cannot use 'return' inside critical`      | same, if-branch copy                                              | E0853                    | `innerStmt.returnStatement()!.start`                                                           | none                                               |
| `TypeValidator.ts:531`  | `E0853: Cannot use 'return' inside critical`      | same, loop-body copy                                              | E0853                    | `loopStmt.returnStatement()!.start`                                                            | none                                               |
| `TypeValidator.ts:554`  | `Error: Cannot switch on boolean type (MISRA`     | cannot switch on boolean (MISRA 16.7, ADR-025)                    | NEW E07xx                | `switchExpr.start`                                                                             | `switch/switch-error-boolean`                      |
| `TypeValidator.ts:560`  | `Error: Switch requires at least 2 clauses`       | switch needs >= 2 clauses (MISRA 16.6)                            | NEW E07xx                | `ctx.start`                                                                                    | `switch/switch-error-single-case`                  |
| `TypeValidator.ts:570`  | `Error: Duplicate case value`                     | duplicate case value                                              | NEW E07xx                | `labelCtx.start`                                                                               | `switch/switch-error-duplicate-case` +2            |
| `TypeValidator.ts:610`  | `Error: switch covers`                            | switch covers N of M variants (explicit + default)                | NEW E07xx                | `ctx.start` / `defaultCase.start`                                                              | `switch/switch-error-wrong-count`                  |
| `TypeValidator.ts:619`  | `Error: Non-exhaustive switch on`                 | non-exhaustive switch                                             | NEW E07xx                | `ctx.start`                                                                                    | `switch/switch-error-non-exhaustive`               |
| `TypeValidator.ts:680`  | `Error: Nested ternary not allowed in`            | nested ternary not allowed                                        | NEW E07xx                | `ctx.start` (`OrExpressionContext`)                                                            | none                                               |
| `TypeValidator.ts:698`  | `condition must be a boolean expression, not a`   | condition must be boolean, not a ternary                          | E0701                    | `ctx.start`                                                                                    | none — untested arm                                |
| `TypeValidator.ts:770`  | `(comparison or logical operation)`               | condition must be boolean (MISRA 14.4)                            | E0701                    | `node.start` (already the precise operand)                                                     | `ternary/ternary-error-non-boolean` +7             |
| `TypeValidator.ts:794`  | `Error E0707: loop condition`                     | loop condition is always true (ADR-068)                           | E0707                    | `ctx.start`                                                                                    | `control-flow/forever-disguised-*` (6)             |
| `TypeValidator.ts:923`  | `Function call in '${conditionType}'`             | function call in condition (MISRA 13.5)                           | E0702                    | `ctx.start`                                                                                    | `conditions/function-call-in-*-error`              |
| `TypeValidator.ts:936`  | `Error E0702: Function call in 'ternary`          | function call in ternary condition                                | E0702                    | `ctx.start` (`OrExpressionContext`)                                                            | `conditions/function-call-in-ternary-error`        |
| `TypeValidator.ts:961`  | `Error: Negative shift amount`                    | negative shift amount is undefined behavior                       | NEW E08xx                | `ctx.start` / `rightExpr.start`                                                                | `bitwise/shift-negative-error`                     |
| `TypeValidator.ts:970`  | `Error: Shift amount`                             | shift exceeds type width (MISRA 12.2)                             | NEW E08xx                | `ctx.start`                                                                                    | `bitwise/shift-beyond-width-*` (4)                 |
| `TypeResolver.ts:153`   | `Error: Negative value`                           | negative value to unsigned type (ADR-024)                         | NEW E08xx                | **none in scope** — `(literalText, targetType)`; thread from callers                           | `casting/literal-negative-unsigned-error`          |
| `TypeResolver.ts:159`   | `Error: Value`                                    | value exceeds type range                                          | NEW E08xx                | same                                                                                           | `casting/literal-overflow-error` +2                |
| `TypeResolver.ts:822`   | `narrowing`                                       | narrowing assignment                                              | NEW E08xx                | same                                                                                           | `casting/narrowing-assign-error`                   |
| `TypeResolver.ts:830`   | `sign change`                                     | sign-change assignment                                            | NEW E08xx                | same                                                                                           | `casting/sign-assign-error`                        |
| `CodeGenerator.ts:1934` | `error[E0703`                                     | `break`/`continue` unsupported (ADR-026)                          | E0703                    | **already emits `ctx.start.line/column`** — the model                                          | `control-flow/break-rejected`, `continue-rejected` |
| `CodeGenerator.ts:2202` | `to access register`                              | use `global.R.m` for a register from inside a scope (ADR-016)     | NEW                      | none — via the `validateRegisterAccess` closure at `:2140`; thread from the member-access site | `scope/cross-scope-register-bare-error`            |
| `CodeGenerator.ts:3812` | `Redundant type`                                  | redundant type in struct initializer (ADR-014)                    | NEW E03xx                | `explicit.symbol` / `ctx.start`                                                                | `structs/struct-redundant-type-error`              |
| `CodeGenerator.ts:3820` | `Cannot infer struct type - no explicit type and` | cannot infer struct type — **fires on valid code, see #1277**     | NEW E03xx                | `ctx.start` (`StructInitializerContext`)                                                       | none                                               |
| `CodeGenerator.ts:4165` | `C-style array parameter is not allowed`          | C-style array parameter                                           | NEW                      | **already positioned** via `ctx.start`                                                         | none                                               |
| `CodeGenerator.ts:4184` | `Unbounded array parameters are not allowed`      | unbounded array parameter                                         | NEW                      | **already positioned** via `ctx.start`                                                         | none                                               |
| `CodeGenerator.ts:4943` | `is not defined; did you mean '`                  | `X` not defined; did you mean `E.X`                               | E0424                    | none — `generatePrimaryExpr(ctx)` has the node                                                 | `analysis/enum-context/enum-bare-in-comparison` +2 |
| `CodeGenerator.ts:4949` | `did you mean ${suggestions}`                     | multi-match arm of the above                                      | E0424                    | same                                                                                           | none                                               |
| `CodeGenerator.ts:4989` | `narrowing`                                       | narrowing cast (ADR-024)                                          | NEW E08xx                | `ctx.start` (`CastExpressionContext`) **is** in scope                                          | `casting/narrowing-cast-error`                     |
| `CodeGenerator.ts:4996` | `sign change`                                     | sign-change cast                                                  | NEW E08xx                | `ctx.start`                                                                                    | `casting/sign-cast-error`                          |

**13 of these 39 already carry a code**; 26 need one. **12 have no fixture at all.** Three emit a
real position today -- the `${line}:${col} `-prefixed rows in the table below.

### `codegen/helpers/` — 38

**Zero carry a code today.** 25 of the 39 have no fixture.

| file:line                        | anchor                                            | message                                                                               | code      | position source                                                              | fixture                                     |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| `TypeGenerationHelper.ts:71`     | `Cannot use 'this.Type' outside of a scope`       | `this.Type` outside a scope                                                           | NEW E0426 | thread `accessors.scopedType()!.start` from `dispatchTypeGeneration`         | none                                        |
| `EnumAssignmentValidator.ts:46`  | `Error: Cannot assign`                            | cannot assign enum of one type to another                                             | NEW E0427 | `expression.start` (in scope)                                                | none                                        |
| `EnumAssignmentValidator.ts:53`  | `Error: Cannot assign integer to`                 | cannot assign integer to enum                                                         | NEW E0428 | `expression.start`                                                           | `enum/enum-error-assign-int`                |
| `EnumAssignmentValidator.ts:131` | `Error: Cannot assign non-enum value to`          | non-enum value to enum (3+ parts)                                                     | NEW E0427 | thread `expression` into `validateNonEnumExpression` (takes only `exprText`) | none                                        |
| `EnumAssignmentValidator.ts:144` | `Error: Cannot assign non-enum value to`          | non-enum value to enum (2 parts)                                                      | NEW E0427 | same                                                                         | none                                        |
| `EnumAssignmentValidator.ts:158` | `Error: Cannot assign non-enum value to`          | non-enum value to enum — **message misreports; real fault is `this` outside a scope** | NEW E0426 | same                                                                         | none                                        |
| `EnumAssignmentValidator.ts:167` | `Error: Cannot assign non-enum value to`          | non-enum value to enum (`this.cfg.v` in scope)                                        | NEW E0427 | same                                                                         | none                                        |
| `ArrayInitHelper.ts:129`         | `Error: Fill-all syntax`                          | fill-all `[v*]` requires explicit array size                                          | NEW E0858 | thread `expression.start` from `processArrayInit`                            | none                                        |
| `ArrayInitHelper.ts:160`         | `Error: Array size mismatch - declared`           | array size mismatch                                                                   | NEW E0857 | `expression.start`                                                           | **orphaned** — see #1361                    |
| `StringDeclHelper.ts:153`        | `Error: String arrays require explicit capacity`  | string arrays require explicit capacity                                               | NEW       | `arrayTypeCtx.stringType()!.start` (in scope)                                | none                                        |
| `StringDeclHelper.ts:218`        | `Error: String array initialization from`         | string array init from variables unsupported                                          | NEW       | `expression.start` (in scope)                                                | none                                        |
| `StringDeclHelper.ts:231`        | `Error: Array size mismatch - declared`           | array size mismatch                                                                   | NEW E0857 | `expression.start`                                                           | **orphaned** — see #1361                    |
| `StringDeclHelper.ts:417`        | `Error: String initialization from variable`      | string init from variable at global scope                                             | NEW       | `expression.start` (in scope)                                                | `string/string-error-init-global`           |
| `StringDeclHelper.ts:447`        | `Error: String literal`                           | literal exceeds `string<C>` capacity                                                  | NEW       | thread `expression` from `_generateBoundedStringWithInit`                    | `string/string-error-overflow`              |
| `StringDeclHelper.ts:457`        | `Error: Cannot assign string`                     | `string<S>` to `string<C>` truncation                                                 | NEW       | same                                                                         | none                                        |
| `StringDeclHelper.ts:500`        | `Error: String concatenation cannot be used at`   | concatenation at global scope                                                         | NEW       | thread `expression`                                                          | `string/string-error-concat-global`         |
| `StringDeclHelper.ts:509`        | `Error: String concatenation requires capacity`   | concatenation exceeds capacity                                                        | NEW       | same                                                                         | `string/string-error-concat-overflow`       |
| `StringDeclHelper.ts:539`        | `Error: Substring extraction cannot be used at`   | substring at global scope                                                             | NEW       | same                                                                         | `string/string-error-substring-global`      |
| `StringDeclHelper.ts:553`        | `Error: Substring bounds`                         | substring bounds exceed source                                                        | NEW       | same                                                                         | `string/string-error-substring-bounds`      |
| `StringDeclHelper.ts:561`        | `Error: Substring length`                         | substring length exceeds destination                                                  | NEW       | same                                                                         | `string/string-error-substring-dest`        |
| `StringDeclHelper.ts:593`        | `Error: Non-const string requires explicit`       | non-const string needs explicit capacity                                              | NEW       | `typeCtx.stringType()!.start` (`expression` may be null)                     | `string/string-error-nonconst-unsized`      |
| `StringDeclHelper.ts:599`        | `Error: const string requires initializer for`    | const string needs initializer                                                        | NEW       | `stringCtx.start` (`expression` null by construction)                        | `string/string-error-const-no-init`         |
| `StringDeclHelper.ts:606`        | `Error: const string requires string literal for` | const string needs a literal                                                          | NEW       | `expression.start` (non-null on this branch)                                 | none                                        |
| `AssignmentValidator.ts:117`     | `constError`                                      | cannot assign to const variable/parameter                                             | NEW       | `targetCtx` (`AssignmentTargetContext`, in scope)                            | 26 fixtures under `tests/const/`            |
| `AssignmentValidator.ts:153`     | `${errorLine}:${col} ${msg}`                      | ADR-024 conversion, assignment path                                                   | NEW       | **already carries a real position**                                          | none                                        |
| `AssignmentValidator.ts:172`     | `array element`                                   | const assign, array element                                                           | NEW       | `subscriptExprs[0].start` (`line` already a parameter)                       | none                                        |
| `AssignmentValidator.ts:203`     | `member access`                                   | const assign, member access                                                           | NEW       | thread `targetCtx`                                                           | none                                        |
| `AssignmentValidator.ts:211`     | `cannot assign to read-only register member`      | write to a read-only (`ro`) register member                                           | NEW       | thread `targetCtx` / `postfixTargetOp`                                       | `register/register-write-ro-error`          |
| `VariableModifierBuilder.ts:82`  | `Cannot use both 'atomic' and 'volatile`          | both `atomic` and `volatile`                                                          | NEW       | `ctx.start` — line already read, column discarded                            | `atomic/atomic-volatile-error`              |
| `VariableDeclHelper.ts:282`      | `C-style array declaration is not allowed`        | C-style array declaration                                                             | NEW E0859 | **already carries a real position** from `ctx.start`                         | `array-declaration-syntax/c-style-error` +1 |
| `VariableDeclHelper.ts:369`      | `Error: C++ class`                                | C++ class with constructor at global scope                                            | NEW       | `typeCtx.start` (in scope)                                                   | `external-types/cpp-class-global-error`     |
| `VariableDeclHelper.ts:768`      | `is not declared`                                 | constructor argument not declared                                                     | NEW       | `argNode.symbol.line/column` (a `TerminalNode` in the loop)                  | `constructor-syntax/error-undeclared-arg`   |
| `VariableDeclHelper.ts:778`      | `must be const`                                   | constructor argument must be const                                                    | NEW       | same                                                                         | `constructor-syntax/error-non-const-arg`    |
| `IntegerLiteralValidator.ts:88`  | `${line}:${col} ${msg}`                           | ADR-024, declaration path                                                             | NEW       | **already carries a real position** from `ctx.start`                         | `casting/literal-overflow-error` +5         |
| `MemberAccessValidator.ts:34`    | `cannot read from write-only register member`     | read from a write-only (`wo`) register member                                         | NEW       | caller `PostfixExpressionGenerator.ts:1461` holds the ctx                    | `register/register-read-wo-error`           |
| `MemberAccessValidator.ts:53`    | `by name. Use 'this`                              | cannot reference own scope by name (ADR-016)                                          | NEW       | caller `PostfixExpressionGenerator.ts:1391`                                  | `scope/self-scope-bare-error` +1            |
| `MemberAccessValidator.ts:108`   | `to access enum`                                  | use `global.X.Y`; scope member shadows global enum                                    | NEW       | callers `PostfixExpressionGenerator.ts:1273/1426/1452`                       | `scope/scope-enum-naming-conflict`          |
| `MemberAccessValidator.ts:129`   | `from inside scope`                               | use `global.X.Y` for enum/register from inside a scope                                | NEW       | same                                                                         | `scope/cross-scope-register-bare-error`     |

`VariableDeclHelper.ts:282`'s doc comment still lists "Exceptions (grammar limitations)" the code
no longer honours — it throws unconditionally once `arrayDimension().length > 0` (#1014–#1017).

### `codegen/generators/**` — 39

| file:line                                    | anchor                                             | message                                                                                       | code      | position source                                                                                              | fixture                                                 |
| -------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `declarationGenerators/ScopeGenerator.ts:97` | `must be const`                                    | constructor argument must be const (C++)                                                      | NEW       | `varDecl.start` — line read at `:181`, inlined as prose                                                      | `constructor-syntax/error-non-const-arg`                |
| `statements/SwitchGenerator.ts:94`           | `error[E0424`                                      | unqualified enum member in a case label                                                       | E0424     | **emits a real position** as a string prefix `ParserUtils` scrapes back                                      | `analysis/enum-context/unqualified-enum-switch-case` +1 |
| `statements/ControlFlowGenerator.ts:47`      | `is not defined; did you mean`                     | unqualified enum member in a return                                                           | E0424     | same mechanism, `exprCtx.start`                                                                              | `analysis/enum-context/unqualified-enum-return-*` (5)   |
| `statements/ControlFlowGenerator.ts:305`     | `Error E0707: for-loop has no controlling`         | `for (;;)` has no controlling expression (ADR-068)                                            | E0707     | `node.start` in scope, **unused**                                                                            | `control-flow/forever-disguised-for-empty`              |
| `statements/ControlFlowGenerator.ts:407`     | `Error E0705: forever loop in non-void function`   | `forever` in a non-void function (ADR-068)                                                    | E0705     | `node.start` in scope, unused                                                                                | `control-flow/forever-non-void-error`                   |
| `support/IncludeGenerator.ts:54`             | `Error: Included C-Next file not found`            | included C-Next file not found                                                                | NEW E0506 | `includeDir` at `CodeGenerator.ts:2478`; `.start.line` read at `:2488` but not threaded                      | none                                                    |
| `support/IncludeGenerator.ts:111`            | `E0501: Function-like macro`                       | function-like macro not allowed                                                               | E0501     | `ctx` (`DefineDirectiveContext`) — line read, appended as `Line 7` prose                                     | `preprocessor/function-macro-error`                     |
| `support/IncludeGenerator.ts:121`            | `E0502: #define with value`                        | `#define` with value not allowed                                                              | E0502     | same prose defect                                                                                            | `preprocessor/value-define-error`                       |
| `expressions/BinaryExprUtils.ts:119`         | `Error: Cannot compare`                            | cannot compare enum to enum (ADR-017)                                                         | NEW E06xx | `node`/`exprs[]` exist at caller `BinaryExprGenerator.ts:144`, not passed in                                 | `enum/enum-error-compare-types`                         |
| `expressions/BinaryExprUtils.ts:125`         | `enum to integer`                                  | cannot compare enum to integer                                                                | NEW E06xx | same                                                                                                         | `enum/enum-error-compare-int`                           |
| `expressions/BinaryExprUtils.ts:129`         | `Error: Cannot compare integer to`                 | cannot compare integer to enum (reversed twin)                                                | NEW E06xx | same                                                                                                         | none                                                    |
| `expressions/BitmapAccessHelper.ts:49`       | `Error: Unknown bitmap field`                      | unknown bitmap field                                                                          | NEW E0426 | none — `IMemberAccessContext` carries no node; thread the owning `PostfixOpContext`                          | none                                                    |
| `expressions/AccessExprGenerator.ts:31`      | `Error: .capacity is only available on string`     | `.capacity` only on string types — **also fires when it _is_ a string with unknown capacity** | NEW E06xx | thread `PostfixOpContext` from `PostfixExpressionGenerator.ts:659`                                           | none                                                    |
| `expressions/AccessExprGenerator.ts:46`      | `Error: .size is only available on string types`   | `.size` only on string types                                                                  | NEW E06xx | same, from `:672`                                                                                            | none                                                    |
| `expressions/CallExprGenerator.ts:371`       | `requires exactly 4 arguments: output`             | `safe_div`/`safe_mod` needs exactly 4 arguments (ADR-051)                                     | NEW       | `argExprs[0].start`, or `ArgumentListContext` at `:268`                                                      | none                                                    |
| `expressions/CallExprGenerator.ts:379`       | `requires a variable as the first argument`        | first argument must be a variable (output parameter)                                          | NEW       | `argExprs[0].start`                                                                                          | none                                                    |
| `expressions/CallExprGenerator.ts:387`       | `Cannot determine type of output parameter`        | cannot determine output parameter type — **really an undeclared identifier**                  | NEW       | `argExprs[0].start`                                                                                          | none                                                    |
| `expressions/CallExprGenerator.ts:443`       | `cannot pass const`                                | cannot pass const to a non-const parameter (ADR-013)                                          | NEW       | `argExprs[argIdx].start`                                                                                     | none                                                    |
| `…/PostfixExpressionGenerator.ts:627`        | `is deprecated. Use explicit properties`           | `.length` deprecated (ADR-058)                                                                | NEW E06xx | `PostfixOpContext` not threaded                                                                              | `errors/length-property-deprecated`                     |
| `…/PostfixExpressionGenerator.ts:742`        | `Error: .bit_length is not supported on 'args`     | `.bit_length` unsupported on `args`                                                           | NEW E06xx | `IExplicitLengthContext` carries no node                                                                     | none                                                    |
| `…/PostfixExpressionGenerator.ts:764`        | `type not found in registry`                       | `.bit_length` — type not in registry (**undeclared identifier**)                              | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:846`        | `unsupported type '${memberType}'`                 | `.bit_length` on an unsupported member type                                                   | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:876`        | `unsupported type '${typeInfo.baseType}'`          | `.bit_length` on an unsupported type                                                          | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:917`        | `.bit_length for array with unknown dimensions`    | `.bit_length` on an array of unknown dimensions                                               | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:924`        | `Error: Cannot determine .bit_length for array`    | `.bit_length` on an array of unsupported element type                                         | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:960`        | `Error: Cannot determine .bit_length for string`   | `.bit_length` on a string of unknown capacity                                                 | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:986`        | `Error: .byte_length is not supported on 'args`    | `.byte_length` unsupported on `args`                                                          | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1018`       | `Error: Cannot determine .byte_length for`         | `.byte_length` — type not in registry (**undeclared identifier**)                             | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1070`       | `arrays, not on '${fieldInfo`                      | `.element_count` on a non-array struct field                                                  | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1087`       | `Error: Cannot determine .element_count for`       | `.element_count` — type not in registry (**undeclared identifier**)                           | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1093`       | `arrays, not on '${typeInfo`                       | `.element_count` on a non-array variable                                                      | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1100`       | `.element_count for array with unknown dimensions` | `.element_count` on an array of unknown dimensions                                            | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1109`       | `Error: .element_count is not available on array`  | `.element_count` on a fully subscripted array                                                 | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1156`       | `Use .element_count for argc`                      | `.char_count` on `args`                                                                       | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1172`       | `strings, not on '${fieldInfo`                     | `.char_count` on a non-string struct field                                                    | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1183`       | `Error: Cannot determine .char_count for`          | `.char_count` — type not in registry (**undeclared identifier**)                              | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1190`       | `strings, not on '${typeInfo`                      | `.char_count` on a non-string variable                                                        | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1785`       | `Cannot use bracket indexing on bitmap type`       | bracket indexing on a bitmap (ADR-034)                                                        | NEW       | **`ctx.op.start` available and already read**, spent on `Error at line 45:` prose — cheapest site to convert | `bitmap/bitmap-bracket-indexing-error`                  |
| `…/PostfixExpressionGenerator.ts:2002`       | `Float bit indexing reads`                         | float bit-range read at global scope                                                          | NEW E08xx | `IFloatBitRangeContext` carries no node; the subscript `op` is available upstream                            | none                                                    |

**32 of the 41 in this area are unpinned**, including all 23 ADR-058 property diagnostics except
`:623`, the ADR-013 const rule, and all four `safe_div`/`safe_mod` checks.

Five sites — one in `CallExprGenerator` and four in `PostfixExpressionGenerator` (their rows are
the ones whose message names a property on an identifier that was never declared) —
fire on an **undeclared identifier**, not on property misuse. The honest fix is one
undefined-identifier diagnostic in symbol resolution; allocating five per-property codes would
bake in a wrong diagnosis.

### `codegen/assignment/**`, `codegen/resolution/`, `headers/` — 25

Attribution here was established by proxying `Error` construction and reading the constructing
stack frame, not by matching message text — necessary because three messages in this area are
byte-identical across sites.

| file:line                               | anchor                                            | message                                                      | code      | position source                                                              | fixture                                             |
| --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| `headers/BaseHeaderGenerator.ts:79`     | `is a typedef of a pointer declared in another`   | typedef of a pointer declared in another header              | E0505     | `origin.sourceLine` (`IHeaderSymbol`) — no parse tree exists                 | none                                                |
| `resolution/ScopeResolver.ts:41`        | `Error: Cannot reference own scope`               | cannot reference own scope by name (ADR-016)                 | NEW E04xx | **none** — `(scopeName, memberName, isGlobalAccess)`; thread from 4+ callers | `scope/self-scope-bare-error`                       |
| `resolution/ScopeResolver.ts:58`        | `Cannot access private member`                    | cannot access a private member (ADR-016)                     | NEW E04xx | same                                                                         | `scope/private-var-access-error` +4                 |
| `resolution/SizeofResolver.ts:154`      | `Error[E0601]: sizeof() on array parameter`       | `sizeof()` on an array parameter (ADR-023)                   | E0601     | none in `throwArrayParamSizeofError(varName)`; thread from `:172`            | `sizeof/array-param-error` +1                       |
| `resolution/SizeofResolver.ts:178`      | `Error[E0602]: sizeof() operand must not have`    | `sizeof()` operand has side effects (MISRA 13.6)             | E0602     | `expr` **is already the parameter** — position available, unused             | `sizeof/side-effects-error` +1                      |
| `handlers/BitAccessHandlers.ts:22`      | `Compound assignment operators not supported for` | compound operator on bit-field access                        | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | `compound-assign/bit-index-compound`                |
| `handlers/ArrayHandlers.ts:120`         | `0 Error: Slice assignment is not supported for`  | slice assignment unsupported for element type                | NEW E08xx | `ctx.subscripts[0]` — line used, column hard-coded `0`                       | none                                                |
| `handlers/ArrayHandlers.ts:234`         | `0 Error: Slice assignment source must be an`     | slice source must be an integer                              | NEW E08xx | `ctx.valueCtx`                                                               | none                                                |
| `handlers/ArrayHandlers.ts:286`         | `0 Error: Slice assignment literal value`         | slice literal does not fit (ADR-052)                         | NEW E08xx | `ctx.valueCtx`                                                               | `slice-assignment/slice-literal-too-wide` +1        |
| `handlers/ArrayHandlers.ts:321`         | `multiple of the element size`                    | slice length must be a multiple of element size              | NEW E08xx | `ctx.subscripts[1]`                                                          | none                                                |
| `handlers/ArrayHandlers.ts:329`         | `0 Error: Slice assignment out of bounds`         | slice out of bounds                                          | NEW E08xx | `ctx.subscripts[0]`                                                          | `slice-assignment/slice-bounds-violation`           |
| `handlers/ArrayHandlers.ts:340`         | `bytes) exceeds`                                  | slice length exceeds source width                            | NEW E08xx | `ctx.subscripts[1]` / `ctx.valueCtx`                                         | `slice-assignment/slice-length-exceeds-source`      |
| `handlers/ArrayHandlers.ts:480`         | `Compound assignment operators not supported for` | compound operator on slice assignment                        | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | none                                                |
| `handlers/ArrayHandlers.ts:496`         | `0 Error: Slice assignment is only valid on`      | slice only valid on 1-D arrays                               | NEW E08xx | `ctx.targetCtx` / `ctx.subscripts[0]`                                        | `multi-dim-arrays/slice-outer-dim-error`            |
| `handlers/ArrayHandlers.ts:508`         | `0 Error: Slice assignment offset must be a`      | slice offset must be compile-time constant                   | NEW E08xx | `ctx.subscripts[0]`                                                          | `slice-assignment/slice-runtime-offsets` +2         |
| `handlers/ArrayHandlers.ts:519`         | `0 Error: Slice assignment length must be a`      | slice length must be compile-time constant                   | NEW E08xx | `ctx.subscripts[1]`                                                          | none                                                |
| `handlers/ArrayHandlers.ts:534`         | `0 Error: Cannot determine buffer size for`       | cannot determine buffer size at compile time                 | NEW E08xx | `ctx.targetCtx`                                                              | none                                                |
| `handlers/ArrayHandlers.ts:540`         | `0 Error: Slice assignment offset cannot be`      | slice offset cannot be negative                              | NEW E08xx | `ctx.subscripts[0]`                                                          | none                                                |
| `handlers/ArrayHandlers.ts:546`         | `0 Error: Slice assignment length must be`        | slice length must be positive                                | NEW E08xx | `ctx.subscripts[1]`                                                          | `slice-assignment/slice-zero-length`                |
| `handlers/StringHandlers.ts:26`         | `Error: Compound operators not supported for`     | compound operator on string assignment (ADR-045)             | NEW       | `ctx.statementCtx.assignmentOperator()`                                      | `string-assignment/string-assign-error-compound` +2 |
| `handlers/AssignmentHandlerUtils.ts:24` | `Compound assignment operators not supported for` | compound operator on bit-field access                        | NEW E08xx | thread `ctx` from `RegisterHandlers.ts:25/60/120/157`                        | none                                                |
| `handlers/AssignmentHandlerUtils.ts:47` | `Cannot assign false to write-only register bit`  | cannot assign `false` to a write-only register bit (ADR-013) | NEW       | thread `ctx.valueCtx` from `RegisterHandlers.ts:43/78/139/184`               | `register/register-wo-set-false-error`              |
| `handlers/AssignmentHandlerUtils.ts:53` | `Cannot assign 0 to write-only register bits`     | cannot assign `0` to write-only register bits                | NEW       | same                                                                         | none                                                |
| `handlers/AccessPatternHandlers.ts:69`  | `Compound assignment operators not supported for` | compound operator on bit-field access                        | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | none                                                |
| `handlers/BitmapHandlers.ts:57`         | `Compound assignment operators not supported for` | compound operator on bitmap field access                     | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | none                                                |

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
- **#1014–#1017 — resolved by deletion.** `StringDeclHelper`'s C-style string-array path was
  dead only while trailing brackets are rejected unconditionally. They are, verified by probe
  on all three routes in, so the path is gone (1322a) and the conditional dependency with it.
