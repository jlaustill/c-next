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

Measured on `main` @ `71fe06f4`:

```bash
grep -rn 'throw new Error' src/transpiler/output --include='*.ts' | grep -v __tests__ | wc -l   # 180
grep -rn 'throw new '      src/transpiler/output --include='*.ts' | grep -v __tests__ | wc -l   # 181
grep -rn 'throw new Error' src/transpiler/logic  --include='*.ts' | grep -v __tests__ | wc -l   # 4
```

#1321 was filed against 177. `throw new Error` is **180**, and one further site throws a
`TypeError` (`StringHandlers.ts:201`), so **181** sites are classified below — this audit covers
every `throw new` in `output/`, not only the `Error` constructor. The number grows with ordinary
work, which is why the acceptance criterion should read "every site as counted at audit time"
rather than a literal.

| bucket | meaning                                                                        | count   |
| ------ | ------------------------------------------------------------------------------ | ------- |
| **1**  | user-facing diagnostic — belongs in pass 2.1, needs a code and a real position | **144** |
| **2**  | internal invariant — should never fire for valid input; becomes an assertion   | **16**  |
| **3**  | dead — unreachable or subsumed; delete                                         | **21**  |
|        | **total**                                                                      | **181** |

**80% of `output/`'s throws are rejections.** That is the answer to open question 4: Render does
not own nothing, it currently owns almost all of the rejection surface.

By area:

| area                                                                | sites | b1  | b2  | b3  |
| ------------------------------------------------------------------- | ----- | --- | --- | --- |
| `codegen/` (root: `CodeGenerator`, `TypeValidator`, `TypeResolver`) | 54    | 39  | 9   | 6   |
| `codegen/helpers/`                                                  | 46    | 39  | 0   | 7   |
| `codegen/generators/**`                                             | 44    | 41  | 3   | 0   |
| `codegen/assignment/**`, `codegen/resolution/`, `headers/`          | 37    | 25  | 4   | 8   |

## Position availability — the finding that shapes #1322

**Only 2 of 181 sites emit a real position.** `SwitchGenerator.ts:94` and
`ControlFlowGenerator.ts:46` prefix `line:col ` into the message text, which
`ParserUtils.parseErrorLocation` scrapes back out at `Transpiler.ts:450`/`:2282`, defaulting to
`1:0`. That is why those two fixtures read `13:13` and `11:13` while nearly every other reads
`1:0`.

Sites divide into three tiers, and the tiers are the natural work split:

| tier  | situation                                                                                           | sites                                                                                                                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | position already computed, then spent on prose (`Error at line 45:`, `Line 7`) or a hard-coded `:0` | `ScopeGenerator.ts:95`, `IncludeGenerator.ts:175/185`, `PostfixExpressionGenerator.ts:1757`, `VariableModifierBuilder.ts:82`, `VariableDeclHelper.ts:768/778`, and the 13 `ArrayHandlers` slice sites                                                                               |
| **B** | an AST node is in scope and simply unused                                                           | every `assignment/handlers/` site (`ctx.statementCtx` / `targetCtx` / `valueCtx` / `subscripts[]`), plus `TypeValidator` and most of `CodeGenerator`                                                                                                                                |
| **C** | no AST node anywhere; must be threaded from callers                                                 | `ScopeResolver.ts:37/53` (string-only signature, 4+ callers), `SizeofResolver.ts:154`, `TypeResolver.ts:153/159/822/830`, most of `PostfixExpressionGenerator` (`IPostfixContext`, `IExplicitLengthContext`, `IMemberAccessContext` and `IFloatBitRangeContext` carry only strings) |

`ISubscriptAccessContext` is the sole context interface that already carries its node (`op:
PostfixOpContext`) and is the model for tier C.

## Duplicate messages — text cannot identify a site

Three messages are byte-identical across multiple throw sites, so any fixture-to-site mapping
done by grepping message text is **wrong**. The `assignment/` audit established attribution by
proxying `Error` construction and reading the constructing stack frame instead.

| message                                                            | sites                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Error: 'this' can only be used inside a scope`                    | **9** — `PostfixExpressionGenerator.ts:470`, `:1344`, `CodeGenerator.ts:4552`, `BaseIdentifierBuilder.ts:44`, `AssignmentHandlerUtils.ts:22`, `AccessPatternHandlers.ts:45`, `StringHandlers.ts:99`, `BitmapHandlers.ts:199`, plus `CodeGenErrors.scopedTypeOutsideScope` |
| `Compound assignment operators not supported for bit field access` | 3 — `BitAccessHandlers.ts:21`, `AssignmentHandlerUtils.ts:38`, `AccessPatternHandlers.ts:73`                                                                                                                                                                              |
| `Cannot reference own scope '<S>' by name`                         | 2 — `ScopeResolver.ts:37`, `MemberAccessValidator.ts:53`                                                                                                                                                                                                                  |
| `Error: Unknown struct variable '<s>' in string assignment`        | 2 — `StringHandlers.ts:60`, `:87` (literal copies)                                                                                                                                                                                                                        |
| `Error: Array size mismatch - declared [N] but got M elements`     | 3 — `StringDeclHelper.ts:231`, `:596`, `ArrayInitHelper.ts:160`                                                                                                                                                                                                           |

Relocating these to 2.1 must **unify each into one decision point**, not port N copies
(`CLAUDE.md`, no duplicate code paths).

## Bucket 2 — internal invariants (16)

Each becomes an assertion. The invariant is stated in words, as #1321 requires; firing means a
transpiler defect, not user error.

| file:line                                                | invariant                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codegen/CodeGenerator.ts:359`                           | every statement name reaching `invokeStatement` was registered by `initializeGenerators()`; the 8 invoked names are a subset of the 8 registered                                                                                                                                   |
| `codegen/CodeGenerator.ts:373`                           | same for `invokeExpression`; the 3 invoked names are among the 14 registered                                                                                                                                                                                                       |
| `codegen/CodeGenerator.ts:2278`                          | the pipeline always supplies `options.symbolInfo` to `generate()`; absence is a caller/API bug                                                                                                                                                                                     |
| `codegen/CodeGenerator.ts:3397`                          | `registerDeclaration("scope")` is unconditional in the constructor                                                                                                                                                                                                                 |
| `codegen/CodeGenerator.ts:3429`                          | `registerDeclaration("register")` is unconditional                                                                                                                                                                                                                                 |
| `codegen/CodeGenerator.ts:3446`                          | `registerDeclaration("struct")` is unconditional                                                                                                                                                                                                                                   |
| `codegen/CodeGenerator.ts:3467`                          | `registerDeclaration("enum")` is unconditional                                                                                                                                                                                                                                     |
| `codegen/CodeGenerator.ts:3492`                          | `registerDeclaration("bitmap")` is unconditional                                                                                                                                                                                                                                   |
| `codegen/CodeGenerator.ts:3714`                          | `registerDeclaration("function")` is unconditional                                                                                                                                                                                                                                 |
| `generators/declarationGenerators/EnumGenerator.ts:47`   | every enum declaration codegen visits was collected by the resolver, so its qualified name is in `enumMembers`                                                                                                                                                                     |
| `generators/declarationGenerators/BitmapGenerator.ts:50` | same, for `bitmapBackingType`                                                                                                                                                                                                                                                      |
| `generators/expressions/CallExprGenerator.ts:394`        | a registered variable always has a non-empty `baseType`; the guard at `:386` already proved `typeInfo` exists                                                                                                                                                                      |
| `assignment/handlers/index.ts:48`                        | every `AssignmentKind` has a registered handler — verified at runtime, all 31 members resolve                                                                                                                                                                                      |
| `assignment/handlers/BitAccessHandlers.ts:150`           | classifier and handler agree on the variable's array-ness; both ARRAY_ELEMENT_BIT sites require `arrayDimensions`                                                                                                                                                                  |
| `assignment/handlers/BitmapHandlers.ts:40`               | classifier and handler agree on the bitmap type key; all five bitmap kinds are classified only after `lookupBitmapFieldWidth` confirms the field                                                                                                                                   |
| `assignment/handlers/StringHandlers.ts:201`              | a `string<N>` capacity is always numeric — the grammar restricts that token to `[0-9]+`. The only site throwing a `TypeError` rather than an `Error`; its own comment records that coercing instead would yield a NaN capacity and corrupt every `strncpy` bound generated from it |

Five of these (`:3389`–`:3706`) already carry an in-file #1285 comment stating exactly this:
_"a missing generator is an internal invariant violation, not a second path."_ Two of the same
family (`:3438`, `:3459`) are spelled `Error: …` rather than `Internal: …`, which makes an
assertion read as a user diagnostic — worth normalizing in the same change.

## Bucket 3 — dead (21)

Each carries evidence that it cannot be reached, not an assumption, as #1321 requires.

| file:line                                          | evidence                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codegen/TypeValidator.ts:384`                     | in `validateBareIdentifierInScope`, which has **zero production callers** — repo-wide grep returns its definition, its unit test, a stale comment at `CodeGenerator.ts:3035`, and a plan doc. Superseded by `resolveBareIdentifier` (ADR-057), which resolves rather than throws                                                   |
| `codegen/TypeValidator.ts:390`                     | same function                                                                                                                                                                                                                                                                                                                      |
| `codegen/TypeValidator.ts:399`                     | same function                                                                                                                                                                                                                                                                                                                      |
| `codegen/TypeValidator.ts:405`                     | same function                                                                                                                                                                                                                                                                                                                      |
| `codegen/TypeValidator.ts:411`                     | same function                                                                                                                                                                                                                                                                                                                      |
| `codegen/TypeValidator.ts:418`                     | same function                                                                                                                                                                                                                                                                                                                      |
| `helpers/TypeGenerationHelper.ts:155`              | `generateArrayBaseType` has no caller in `src/` or `scripts/` — only its unit test. Live array-element typing goes through `dispatchTypeGeneration`, which returns `null` and falls back to `ctx.getText()`                                                                                                                        |
| `helpers/EnumAssignmentValidator.ts:189`           | reaching it needs `isKnownEnum(parts[1])` with `parts[0]==="global"` and `length>=3`. `EnumTypeResolver.getEnumTypeFromGlobalEnum:133-139` evaluates the identical predicate on the identical `getText()` earlier (`validateEnumAssignment:41`) and returns non-null, so `validateNonEnumExpression` is never entered in that case |
| `helpers/StringDeclHelper.ts:515`                  | in `_generateStringArrayDecl`, entered only when `arrayDims.length > 0`; `VariableDeclHelper.validateArrayDeclarationSyntax` (`:635`, before `StringDeclHelper` at `:655`) throws unconditionally on any trailing bracket. Confirmed: `string<8> items[3] <- [...]` yields the C-style-array error                                 |
| `helpers/StringDeclHelper.ts:559`                  | `_handleSizeInference`'s sole call site is `_generateStringArrayDecl:527` — same unreachable branch                                                                                                                                                                                                                                |
| `helpers/StringDeclHelper.ts:596`                  | `_handleExplicitSize`'s sole call site is `_generateStringArrayDecl:529` — same branch                                                                                                                                                                                                                                             |
| `helpers/CastValidator.ts:103`                     | `validateIntegerCast` has no production caller (grep: definition + unit test). `tests/casting/narrowing-cast-error` is produced by the live duplicate at `CodeGenerator.ts:4683`                                                                                                                                                   |
| `helpers/CastValidator.ts:111`                     | same; live copy at `CodeGenerator.ts:4690` pins `tests/casting/sign-cast-error`                                                                                                                                                                                                                                                    |
| `assignment/handlers/StringHandlers.ts:60`         | STRING_STRUCT_FIELD is produced only via `_resolveStructType` (`AssignmentClassifier.ts:876-883`), which runs the identical `getVariableTypeInfo(structName)` with the identical key and returns `null` on failure                                                                                                                 |
| `assignment/handlers/StringHandlers.ts:71`         | same path additionally requires `getStructFieldType` truthy and `TypeCheckUtils.isString` (`AssignmentClassifier.ts:906-925`)                                                                                                                                                                                                      |
| `assignment/handlers/StringHandlers.ts:87`         | only caller is `handleStringStructArrayElement`, gated by the same `_resolveStructType`. Also a literal duplicate of `:60`                                                                                                                                                                                                         |
| `assignment/handlers/StringHandlers.ts:99`         | two proofs: `_classifyThisMemberString` returns `null` when `!CodeGenState.currentScope` (`:845`), and `buildAssignmentContext` calls `generateAssignmentTarget` first, so `this.`-outside-scope throws at `BaseIdentifierBuilder.ts:44` — reproduced with `this.name <- "bob"`                                                    |
| `assignment/handlers/StringHandlers.ts:185`        | `_classifyStructArrayElementString` requires `dimensions && dimensions.length >= 1` (`:958-963`) from the same map with the same keys; the handler rejects only `!dimensions \|\| length === 0`                                                                                                                                    |
| `assignment/handlers/AssignmentHandlerUtils.ts:21` | callers are `RegisterHandlers.ts:119/156`, produced solely by `classifyThisWithArrayAccess`, reached only after `classifyThisPrefix`'s `!currentScope` early return (`:585-588`). Reproduced: `this.HW.DR[3] <- true` at file scope lands on `BaseIdentifierBuilder.ts:44`                                                         |
| `assignment/handlers/AccessPatternHandlers.ts:45`  | same two proofs. Reproduced: `this.count <- 5` at file scope lands on `BaseIdentifierBuilder.ts:44`                                                                                                                                                                                                                                |
| `assignment/handlers/BitmapHandlers.ts:199`        | `SCOPED_REGISTER_MEMBER_BITMAP_FIELD` with `hasThis` comes only from `classifyThisPrefix:613`, past the `currentScope` guard at `:586`. Reproduced: `this.HW.CTRL.Run <- true` at file scope                                                                                                                                       |

**`CastValidator.ts:103/111` is a duplicate code path, not merely dead** — identical message text
and identical rules to the live logic inlined at `CodeGenerator.ts:4677-4696`. Deleting the
unreachable copy is the correct resolution; leaving both is the anti-pattern `CLAUDE.md` forbids.

Three bucket-3 calls are **conditional on current behavior** and must be revisited if it changes:
`StringDeclHelper.ts:515/559/596` are dead only while `validateArrayDeclarationSyntax` rejects all
trailing brackets (#1014–#1017), and the stale doc comment at `VariableDeclHelper.ts:243-247`
still describes the relaxed behavior.

## Bucket 1 — user-facing diagnostics (144)

Each needs a code and a real position in pass 2.1. `code` is the code it already carries, or
**NEW** where one must be allocated. `position` names the node that is or would be in scope.

### `codegen/` root — 39

| file:line               | message                                                           | code                     | position source                                                                                | fixture                                            |
| ----------------------- | ----------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `TypeValidator.ts:58`   | cannot `#include` an implementation file (ADR-010)                | E0503                    | `includeDir` (`IncludeDirectiveContext`) at `CodeGenerator.ts:2455`                            | `preprocessor/include-impl-file-error`             |
| `TypeValidator.ts:129`  | `#include "p"` but `p.cnx` exists alongside                       | E0504                    | same `includeDir`, `CodeGenerator.ts:2464`                                                     | `include/cnx-alternative-error-quoted`             |
| `TypeValidator.ts:146`  | angle-include twin of the above                                   | E0504                    | same                                                                                           | `include/cnx-alternative-error-angle`              |
| `TypeValidator.ts:177`  | value exceeds W-bit bitmap field maximum (ADR-034)                | NEW E08xx                | `expr` (`ExpressionContext`, a parameter)                                                      | `bitmap/bitmap-error-overflow`                     |
| `TypeValidator.ts:237`  | array index is negative                                           | NEW — **E0854 reserved** | `indexExprs[i].start`                                                                          | none                                               |
| `TypeValidator.ts:245`  | array index `N >= D`                                              | NEW — E0854              | `indexExprs[i].start`                                                                          | `array-initializers/bounds-error` +3               |
| `TypeValidator.ts:276`  | function signature does not match callback type                   | NEW                      | `valueExpr.start`                                                                              | none                                               |
| `TypeValidator.ts:285`  | cannot assign function to callback field (ADR-029 nominal typing) | NEW                      | `valueExpr.start`                                                                              | `callbacks/callback-error-nominal`                 |
| `TypeValidator.ts:545`  | `return` inside `critical` (ADR-050)                              | E0853                    | `stmt.returnStatement()!.start`                                                                | `critical/return-error`                            |
| `TypeValidator.ts:566`  | same, if-branch copy                                              | E0853                    | `innerStmt.returnStatement()!.start`                                                           | none                                               |
| `TypeValidator.ts:594`  | same, loop-body copy                                              | E0853                    | `loopStmt.returnStatement()!.start`                                                            | none                                               |
| `TypeValidator.ts:617`  | cannot switch on boolean (MISRA 16.7, ADR-025)                    | NEW E07xx                | `switchExpr.start`                                                                             | `switch/switch-error-boolean`                      |
| `TypeValidator.ts:623`  | switch needs >= 2 clauses (MISRA 16.6)                            | NEW E07xx                | `ctx.start`                                                                                    | `switch/switch-error-single-case`                  |
| `TypeValidator.ts:633`  | duplicate case value                                              | NEW E07xx                | `labelCtx.start`                                                                               | `switch/switch-error-duplicate-case` +2            |
| `TypeValidator.ts:673`  | switch covers N of M variants (explicit + default)                | NEW E07xx                | `ctx.start` / `defaultCase.start`                                                              | `switch/switch-error-wrong-count`                  |
| `TypeValidator.ts:682`  | non-exhaustive switch                                             | NEW E07xx                | `ctx.start`                                                                                    | `switch/switch-error-non-exhaustive`               |
| `TypeValidator.ts:743`  | nested ternary not allowed                                        | NEW E07xx                | `ctx.start` (`OrExpressionContext`)                                                            | none                                               |
| `TypeValidator.ts:761`  | condition must be boolean, not a ternary                          | E0701                    | `ctx.start`                                                                                    | none — untested arm                                |
| `TypeValidator.ts:833`  | condition must be boolean (MISRA 14.4)                            | E0701                    | `node.start` (already the precise operand)                                                     | `ternary/ternary-error-non-boolean` +7             |
| `TypeValidator.ts:857`  | loop condition is always true (ADR-068)                           | E0707                    | `ctx.start`                                                                                    | `control-flow/forever-disguised-*` (6)             |
| `TypeValidator.ts:986`  | function call in condition (MISRA 13.5)                           | E0702                    | `ctx.start`                                                                                    | `conditions/function-call-in-*-error`              |
| `TypeValidator.ts:999`  | function call in ternary condition                                | E0702                    | `ctx.start` (`OrExpressionContext`)                                                            | `conditions/function-call-in-ternary-error`        |
| `TypeValidator.ts:1024` | negative shift amount is undefined behavior                       | NEW E08xx                | `ctx.start` / `rightExpr.start`                                                                | `bitwise/shift-negative-error`                     |
| `TypeValidator.ts:1033` | shift exceeds type width (MISRA 12.2)                             | NEW E08xx                | `ctx.start`                                                                                    | `bitwise/shift-beyond-width-*` (4)                 |
| `TypeResolver.ts:153`   | negative value to unsigned type (ADR-024)                         | NEW E08xx                | **none in scope** — `(literalText, targetType)`; thread from callers                           | `casting/literal-negative-unsigned-error`          |
| `TypeResolver.ts:159`   | value exceeds type range                                          | NEW E08xx                | same                                                                                           | `casting/literal-overflow-error` +2                |
| `TypeResolver.ts:822`   | narrowing assignment                                              | NEW E08xx                | same                                                                                           | `casting/narrowing-assign-error`                   |
| `TypeResolver.ts:830`   | sign-change assignment                                            | NEW E08xx                | same                                                                                           | `casting/sign-assign-error`                        |
| `CodeGenerator.ts:1930` | `break`/`continue` unsupported (ADR-026)                          | E0703                    | **already emits `ctx.start.line/column`** — the model                                          | `control-flow/break-rejected`, `continue-rejected` |
| `CodeGenerator.ts:2198` | use `global.R.m` for a register from inside a scope (ADR-016)     | NEW                      | none — via the `validateRegisterAccess` closure at `:2140`; thread from the member-access site | `scope/cross-scope-register-bare-error`            |
| `CodeGenerator.ts:3515` | redundant type in struct initializer (ADR-014)                    | NEW E03xx                | `explicit.symbol` / `ctx.start`                                                                | `structs/struct-redundant-type-error`              |
| `CodeGenerator.ts:3523` | cannot infer struct type — **fires on valid code, see #1277**     | NEW E03xx                | `ctx.start` (`StructInitializerContext`)                                                       | none                                               |
| `CodeGenerator.ts:3869` | C-style array parameter                                           | NEW                      | **already positioned** via `ctx.start`                                                         | none                                               |
| `CodeGenerator.ts:3888` | unbounded array parameter                                         | NEW                      | **already positioned** via `ctx.start`                                                         | none                                               |
| `CodeGenerator.ts:4559` | `this` outside a scope                                            | NEW E04xx                | none — caller `generatePrimaryExpr(ctx)` at `:1911` has `ctx.start`                            | none                                               |
| `CodeGenerator.ts:4644` | `X` not defined; did you mean `E.X`                               | E0424                    | none — `generatePrimaryExpr(ctx)` has the node                                                 | `analysis/enum-context/enum-bare-in-comparison` +2 |
| `CodeGenerator.ts:4650` | multi-match arm of the above                                      | E0424                    | same                                                                                           | none                                               |
| `CodeGenerator.ts:4690` | narrowing cast (ADR-024)                                          | NEW E08xx                | `ctx.start` (`CastExpressionContext`) **is** in scope                                          | `casting/narrowing-cast-error`                     |
| `CodeGenerator.ts:4697` | sign-change cast                                                  | NEW E08xx                | `ctx.start`                                                                                    | `casting/sign-cast-error`                          |

**13 of these 39 already carry a code**; 26 need one. **12 have no fixture at all.** Only
`CodeGenerator.ts:1926/3862/3881` emit a real position today.

### `codegen/helpers/` — 39

**Zero carry a code today.** 25 of the 39 have no fixture.

| file:line                        | message                                                                               | code      | position source                                                              | fixture                                     |
| -------------------------------- | ------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| `TypeGenerationHelper.ts:71`     | `this.Type` outside a scope                                                           | NEW E0426 | thread `accessors.scopedType()!.start` from `dispatchTypeGeneration`         | none                                        |
| `EnumAssignmentValidator.ts:46`  | cannot assign enum of one type to another                                             | NEW E0427 | `expression.start` (in scope)                                                | none                                        |
| `EnumAssignmentValidator.ts:53`  | cannot assign integer to enum                                                         | NEW E0428 | `expression.start`                                                           | `enum/enum-error-assign-int`                |
| `EnumAssignmentValidator.ts:127` | non-enum value to enum (3+ parts)                                                     | NEW E0427 | thread `expression` into `validateNonEnumExpression` (takes only `exprText`) | none                                        |
| `EnumAssignmentValidator.ts:140` | non-enum value to enum (2 parts)                                                      | NEW E0427 | same                                                                         | none                                        |
| `EnumAssignmentValidator.ts:154` | non-enum value to enum — **message misreports; real fault is `this` outside a scope** | NEW E0426 | same                                                                         | none                                        |
| `EnumAssignmentValidator.ts:163` | non-enum value to enum (`this.cfg.v` in scope)                                        | NEW E0427 | same                                                                         | none                                        |
| `ArrayInitHelper.ts:129`         | fill-all `[v*]` requires explicit array size                                          | NEW E0858 | thread `expression.start` from `processArrayInit`                            | none                                        |
| `ArrayInitHelper.ts:160`         | array size mismatch                                                                   | NEW E0857 | `expression.start`                                                           | **orphaned** — see #1361                    |
| `StringDeclHelper.ts:153`        | string arrays require explicit capacity                                               | NEW       | `arrayTypeCtx.stringType()!.start` (in scope)                                | none                                        |
| `StringDeclHelper.ts:218`        | string array init from variables unsupported                                          | NEW       | `expression.start` (in scope)                                                | none                                        |
| `StringDeclHelper.ts:231`        | array size mismatch                                                                   | NEW E0857 | `expression.start`                                                           | **orphaned** — see #1361                    |
| `StringDeclHelper.ts:430`        | string init from variable at global scope                                             | NEW       | `expression.start` (in scope)                                                | `string/string-error-init-global`           |
| `StringDeclHelper.ts:460`        | literal exceeds `string<C>` capacity                                                  | NEW       | thread `expression` from `_generateBoundedStringWithInit`                    | `string/string-error-overflow`              |
| `StringDeclHelper.ts:470`        | `string<S>` to `string<C>` truncation                                                 | NEW       | same                                                                         | none                                        |
| `StringDeclHelper.ts:641`        | concatenation at global scope                                                         | NEW       | thread `expression`                                                          | `string/string-error-concat-global`         |
| `StringDeclHelper.ts:650`        | concatenation exceeds capacity                                                        | NEW       | same                                                                         | `string/string-error-concat-overflow`       |
| `StringDeclHelper.ts:680`        | substring at global scope                                                             | NEW       | same                                                                         | `string/string-error-substring-global`      |
| `StringDeclHelper.ts:694`        | substring bounds exceed source                                                        | NEW       | same                                                                         | `string/string-error-substring-bounds`      |
| `StringDeclHelper.ts:702`        | substring length exceeds destination                                                  | NEW       | same                                                                         | `string/string-error-substring-dest`        |
| `StringDeclHelper.ts:734`        | non-const string needs explicit capacity                                              | NEW       | `typeCtx.stringType()!.start` (`expression` may be null)                     | `string/string-error-nonconst-unsized`      |
| `StringDeclHelper.ts:740`        | const string needs initializer                                                        | NEW       | `stringCtx.start` (`expression` null by construction)                        | `string/string-error-const-no-init`         |
| `StringDeclHelper.ts:747`        | const string needs a literal                                                          | NEW       | `expression.start` (non-null on this branch)                                 | none                                        |
| `AssignmentValidator.ts:117`     | cannot assign to const variable/parameter                                             | NEW       | `targetCtx` (`AssignmentTargetContext`, in scope)                            | 26 fixtures under `tests/const/`            |
| `AssignmentValidator.ts:153`     | ADR-024 conversion, assignment path                                                   | NEW       | **already carries a real position**                                          | none                                        |
| `AssignmentValidator.ts:172`     | const assign, array element                                                           | NEW       | `subscriptExprs[0].start` (`line` already a parameter)                       | none                                        |
| `AssignmentValidator.ts:203`     | const assign, member access                                                           | NEW       | thread `targetCtx`                                                           | none                                        |
| `AssignmentValidator.ts:211`     | write to a read-only (`ro`) register member                                           | NEW       | thread `targetCtx` / `postfixTargetOp`                                       | `register/register-write-ro-error`          |
| `VariableModifierBuilder.ts:82`  | both `atomic` and `volatile`                                                          | NEW       | `ctx.start` — line already read, column discarded                            | `atomic/atomic-volatile-error`              |
| `BaseIdentifierBuilder.ts:43`    | `this` outside a scope — **1 of 9 copies**                                            | NEW E0426 | caller `CodeGenerator.ts:1248` holds the target ctx                          | none                                        |
| `VariableDeclHelper.ts:282`      | C-style array declaration                                                             | NEW E0859 | **already carries a real position** from `ctx.start`                         | `array-declaration-syntax/c-style-error` +1 |
| `VariableDeclHelper.ts:369`      | C++ class with constructor at global scope                                            | NEW       | `typeCtx.start` (in scope)                                                   | `external-types/cpp-class-global-error`     |
| `VariableDeclHelper.ts:768`      | constructor argument not declared                                                     | NEW       | `argNode.symbol.line/column` (a `TerminalNode` in the loop)                  | `constructor-syntax/error-undeclared-arg`   |
| `VariableDeclHelper.ts:778`      | constructor argument must be const                                                    | NEW       | same                                                                         | `constructor-syntax/error-non-const-arg`    |
| `IntegerLiteralValidator.ts:88`  | ADR-024, declaration path                                                             | NEW       | **already carries a real position** from `ctx.start`                         | `casting/literal-overflow-error` +5         |
| `MemberAccessValidator.ts:34`    | read from a write-only (`wo`) register member                                         | NEW       | caller `PostfixExpressionGenerator.ts:1461` holds the ctx                    | `register/register-read-wo-error`           |
| `MemberAccessValidator.ts:53`    | cannot reference own scope by name (ADR-016)                                          | NEW       | caller `PostfixExpressionGenerator.ts:1386`                                  | `scope/self-scope-bare-error` +1            |
| `MemberAccessValidator.ts:108`   | use `global.X.Y`; scope member shadows global enum                                    | NEW       | callers `PostfixExpressionGenerator.ts:1273/1426/1452`                       | `scope/scope-enum-naming-conflict`          |
| `MemberAccessValidator.ts:129`   | use `global.X.Y` for enum/register from inside a scope                                | NEW       | same                                                                         | `scope/cross-scope-register-bare-error`     |

`VariableDeclHelper.ts:282`'s doc comment still lists "Exceptions (grammar limitations)" the code
no longer honours — it throws unconditionally once `arrayDimension().length > 0` (#1014–#1017).

### `codegen/generators/**` — 41

| file:line                                       | message                                                                                       | code      | position source                                                                                              | fixture                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `declarationGenerators/ScopeGenerator.ts:94`    | constructor argument must be const (C++)                                                      | NEW       | `varDecl.start` — line read at `:176`, inlined as prose                                                      | `constructor-syntax/error-non-const-arg`                |
| `statements/SwitchGenerator.ts:94`              | unqualified enum member in a case label                                                       | E0424     | **emits a real position** as a string prefix `ParserUtils` scrapes back                                      | `analysis/enum-context/unqualified-enum-switch-case` +1 |
| `statements/ControlFlowGenerator.ts:46`         | unqualified enum member in a return                                                           | E0424     | same mechanism, `exprCtx.start`                                                                              | `analysis/enum-context/unqualified-enum-return-*` (5)   |
| `statements/ControlFlowGenerator.ts:302`        | `for (;;)` has no controlling expression (ADR-068)                                            | E0707     | `node.start` in scope, **unused**                                                                            | `control-flow/forever-disguised-for-empty`              |
| `statements/ControlFlowGenerator.ts:404`        | `forever` in a non-void function (ADR-068)                                                    | E0705     | `node.start` in scope, unused                                                                                | `control-flow/forever-non-void-error`                   |
| `support/IncludeGenerator.ts:110`               | included C-Next file not found                                                                | NEW E0506 | `includeDir` at `CodeGenerator.ts:2455`; `.start.line` read at `:2459` but not threaded                      | none                                                    |
| `support/IncludeGenerator.ts:175`               | function-like macro not allowed                                                               | E0501     | `ctx` (`DefineDirectiveContext`) — line read, appended as `Line 7` prose                                     | `preprocessor/function-macro-error`                     |
| `support/IncludeGenerator.ts:185`               | `#define` with value not allowed                                                              | E0502     | same prose defect                                                                                            | `preprocessor/value-define-error`                       |
| `expressions/BinaryExprUtils.ts:119`            | cannot compare enum to enum (ADR-017)                                                         | NEW E06xx | `node`/`exprs[]` exist at caller `BinaryExprGenerator.ts:144`, not passed in                                 | `enum/enum-error-compare-types`                         |
| `expressions/BinaryExprUtils.ts:125`            | cannot compare enum to integer                                                                | NEW E06xx | same                                                                                                         | `enum/enum-error-compare-int`                           |
| `expressions/BinaryExprUtils.ts:129`            | cannot compare integer to enum (reversed twin)                                                | NEW E06xx | same                                                                                                         | none                                                    |
| `expressions/BitmapAccessHelper.ts:51`          | unknown bitmap field                                                                          | NEW E0426 | none — `IMemberAccessContext` carries no node; thread the owning `PostfixOpContext`                          | none                                                    |
| `expressions/AccessExprGenerator.ts:30`         | `.capacity` only on string types — **also fires when it _is_ a string with unknown capacity** | NEW E06xx | thread `PostfixOpContext` from `PostfixExpressionGenerator.ts:659`                                           | none                                                    |
| `expressions/AccessExprGenerator.ts:45`         | `.size` only on string types                                                                  | NEW E06xx | same, from `:672`                                                                                            | none                                                    |
| `expressions/CallExprGenerator.ts:370`          | `safe_div`/`safe_mod` needs exactly 4 arguments (ADR-051)                                     | NEW       | `argExprs[0].start`, or `ArgumentListContext` at `:268`                                                      | none                                                    |
| `expressions/CallExprGenerator.ts:378`          | first argument must be a variable (output parameter)                                          | NEW       | `argExprs[0].start`                                                                                          | none                                                    |
| `expressions/CallExprGenerator.ts:386`          | cannot determine output parameter type — **really an undeclared identifier**                  | NEW       | `argExprs[0].start`                                                                                          | none                                                    |
| `expressions/CallExprGenerator.ts:443`          | cannot pass const to a non-const parameter (ADR-013)                                          | NEW       | `argExprs[argIdx].start`                                                                                     | none                                                    |
| `expressions/PostfixExpressionGenerator.ts:471` | `this` outside a scope — wins for member `length` only                                        | NEW E04xx | none — `IPostfixContext` carries no node                                                                     | none                                                    |
| `…/PostfixExpressionGenerator.ts:629`           | `.length` deprecated (ADR-058)                                                                | NEW E06xx | `PostfixOpContext` not threaded                                                                              | `errors/length-property-deprecated`                     |
| `…/PostfixExpressionGenerator.ts:744`           | `.bit_length` unsupported on `args`                                                           | NEW E06xx | `IExplicitLengthContext` carries no node                                                                     | none                                                    |
| `…/PostfixExpressionGenerator.ts:766`           | `.bit_length` — type not in registry (**undeclared identifier**)                              | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:848`           | `.bit_length` on an unsupported member type                                                   | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:878`           | `.bit_length` on an unsupported type                                                          | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:919`           | `.bit_length` on an array of unknown dimensions                                               | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:926`           | `.bit_length` on an array of unsupported element type                                         | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:962`           | `.bit_length` on a string of unknown capacity                                                 | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:988`           | `.byte_length` unsupported on `args`                                                          | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1020`          | `.byte_length` — type not in registry (**undeclared identifier**)                             | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1072`          | `.element_count` on a non-array struct field                                                  | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1089`          | `.element_count` — type not in registry (**undeclared identifier**)                           | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1095`          | `.element_count` on a non-array variable                                                      | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1102`          | `.element_count` on an array of unknown dimensions                                            | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1111`          | `.element_count` on a fully subscripted array                                                 | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1158`          | `.char_count` on `args`                                                                       | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1174`          | `.char_count` on a non-string struct field                                                    | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1185`          | `.char_count` — type not in registry (**undeclared identifier**)                              | NEW E04xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1192`          | `.char_count` on a non-string variable                                                        | NEW E06xx | not threaded                                                                                                 | none                                                    |
| `…/PostfixExpressionGenerator.ts:1350`          | `this` outside a scope — every member except `length`                                         | NEW E04xx | `IMemberAccessContext` carries no node                                                                       | none                                                    |
| `…/PostfixExpressionGenerator.ts:1790`          | bracket indexing on a bitmap (ADR-034)                                                        | NEW       | **`ctx.op.start` available and already read**, spent on `Error at line 45:` prose — cheapest site to convert | `bitmap/bitmap-bracket-indexing-error`                  |
| `…/PostfixExpressionGenerator.ts:2007`          | float bit-range read at global scope                                                          | NEW E08xx | `IFloatBitRangeContext` carries no node; the subscript `op` is available upstream                            | none                                                    |

**32 of 44 in this area are unpinned**, including all 23 ADR-058 property diagnostics except
`:623`, the ADR-013 const rule, and all four `safe_div`/`safe_mod` checks.

Five sites — `CallExprGenerator.ts:386` and `PostfixExpressionGenerator.ts:760/1014/1083/1179` —
fire on an **undeclared identifier**, not on property misuse. The honest fix is one
undefined-identifier diagnostic in symbol resolution; allocating five per-property codes would
bake in a wrong diagnosis.

### `codegen/assignment/**`, `codegen/resolution/`, `headers/` — 25

Attribution here was established by proxying `Error` construction and reading the constructing
stack frame, not by matching message text — necessary because three messages in this area are
byte-identical across sites.

| file:line                               | message                                                      | code      | position source                                                              | fixture                                             |
| --------------------------------------- | ------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| `headers/BaseHeaderGenerator.ts:82`     | typedef of a pointer declared in another header              | E0505     | `origin.sourceLine` (`IHeaderSymbol`) — no parse tree exists                 | none                                                |
| `resolution/ScopeResolver.ts:41`        | cannot reference own scope by name (ADR-016)                 | NEW E04xx | **none** — `(scopeName, memberName, isGlobalAccess)`; thread from 4+ callers | `scope/self-scope-bare-error`                       |
| `resolution/ScopeResolver.ts:58`        | cannot access a private member (ADR-016)                     | NEW E04xx | same                                                                         | `scope/private-var-access-error` +4                 |
| `resolution/SizeofResolver.ts:154`      | `sizeof()` on an array parameter (ADR-023)                   | E0601     | none in `throwArrayParamSizeofError(varName)`; thread from `:172`            | `sizeof/array-param-error` +1                       |
| `resolution/SizeofResolver.ts:178`      | `sizeof()` operand has side effects (MISRA 13.6)             | E0602     | `expr` **is already the parameter** — position available, unused             | `sizeof/side-effects-error` +1                      |
| `handlers/BitAccessHandlers.ts:21`      | compound operator on bit-field access                        | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | `compound-assign/bit-index-compound`                |
| `handlers/ArrayHandlers.ts:120`         | slice assignment unsupported for element type                | NEW E08xx | `ctx.subscripts[0]` — line used, column hard-coded `0`                       | none                                                |
| `handlers/ArrayHandlers.ts:234`         | slice source must be an integer                              | NEW E08xx | `ctx.valueCtx`                                                               | none                                                |
| `handlers/ArrayHandlers.ts:286`         | slice literal does not fit (ADR-052)                         | NEW E08xx | `ctx.valueCtx`                                                               | `slice-assignment/slice-literal-too-wide` +1        |
| `handlers/ArrayHandlers.ts:321`         | slice length must be a multiple of element size              | NEW E08xx | `ctx.subscripts[1]`                                                          | none                                                |
| `handlers/ArrayHandlers.ts:329`         | slice out of bounds                                          | NEW E08xx | `ctx.subscripts[0]`                                                          | `slice-assignment/slice-bounds-violation`           |
| `handlers/ArrayHandlers.ts:340`         | slice length exceeds source width                            | NEW E08xx | `ctx.subscripts[1]` / `ctx.valueCtx`                                         | `slice-assignment/slice-length-exceeds-source`      |
| `handlers/ArrayHandlers.ts:480`         | compound operator on slice assignment                        | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | none                                                |
| `handlers/ArrayHandlers.ts:496`         | slice only valid on 1-D arrays                               | NEW E08xx | `ctx.targetCtx` / `ctx.subscripts[0]`                                        | `multi-dim-arrays/slice-outer-dim-error`            |
| `handlers/ArrayHandlers.ts:508`         | slice offset must be compile-time constant                   | NEW E08xx | `ctx.subscripts[0]`                                                          | `slice-assignment/slice-runtime-offsets` +2         |
| `handlers/ArrayHandlers.ts:519`         | slice length must be compile-time constant                   | NEW E08xx | `ctx.subscripts[1]`                                                          | none                                                |
| `handlers/ArrayHandlers.ts:534`         | cannot determine buffer size at compile time                 | NEW E08xx | `ctx.targetCtx`                                                              | none                                                |
| `handlers/ArrayHandlers.ts:540`         | slice offset cannot be negative                              | NEW E08xx | `ctx.subscripts[0]`                                                          | none                                                |
| `handlers/ArrayHandlers.ts:546`         | slice length must be positive                                | NEW E08xx | `ctx.subscripts[1]`                                                          | `slice-assignment/slice-zero-length`                |
| `handlers/StringHandlers.ts:25`         | compound operator on string assignment (ADR-045)             | NEW       | `ctx.statementCtx.assignmentOperator()`                                      | `string-assignment/string-assign-error-compound` +2 |
| `handlers/AssignmentHandlerUtils.ts:37` | compound operator on bit-field access                        | NEW E08xx | thread `ctx` from `RegisterHandlers.ts:25/60/120/157`                        | none                                                |
| `handlers/AssignmentHandlerUtils.ts:60` | cannot assign `false` to a write-only register bit (ADR-013) | NEW       | thread `ctx.valueCtx` from `RegisterHandlers.ts:43/78/139/184`               | `register/register-wo-set-false-error`              |
| `handlers/AssignmentHandlerUtils.ts:66` | cannot assign `0` to write-only register bits                | NEW       | same                                                                         | none                                                |
| `handlers/AccessPatternHandlers.ts:73`  | compound operator on bit-field access                        | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | none                                                |
| `handlers/BitmapHandlers.ts:49`         | compound operator on bitmap field access                     | NEW E08xx | `ctx.statementCtx.assignmentOperator()`                                      | none                                                |

The 13 `ArrayHandlers` slice sites **already smuggle a position through the message string** as a
`${line}:0` prefix that a downstream layer parses — which is why
`slice-assignment/slice-runtime-offsets.expected.error` reads `12:0` while most others read `1:0`.
The line is real, the column is a hard-coded `0`, and the mechanism is string formatting rather
than a carried node. Moving these to 2.1 **replaces an existing hack** rather than adding
positions where none exist.

## Proposed split of #1322

The last acceptance criterion of #1321 is that the relocation card becomes workable pieces. The
position tiers above give the split, ordered so each piece is independently mergeable:

| piece              | scope                                                                                 | why it is separable                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **1322a — delete** | the 21 bucket-3 sites                                                                 | no diagnostic changes; pure removal, and it shrinks every later piece. `CastValidator.ts:103/111` also retires a duplicate code path            |
| **1322b — assert** | the 15 bucket-2 sites                                                                 | converts to assertions and normalizes the `Error:`/`Internal:` split; no user-visible behavior                                                  |
| **1322c — tier A** | ~20 sites already computing a position and spending it on prose or `:0`               | the position exists; this is moving it from the message into the diagnostic. Includes all 13 slice sites, which replaces the string-prefix hack |
| **1322d — tier B** | the `assignment/handlers/` and `TypeValidator` sites with a node in scope             | mechanical: read `ctx.*.start` instead of discarding it                                                                                         |
| **1322e — tier C** | sites with no node, needing threading from callers                                    | the real work: `ScopeResolver`, `SizeofResolver`, `TypeResolver`, and the `PostfixExpressionGenerator` context interfaces                       |
| **1322f — unify**  | the 5 duplicated messages, notably the 9-way `'this' can only be used inside a scope` | must land as one decision point, not N ported copies                                                                                            |

Piece **1322e** should also resolve the five sites that report a property error for what is
actually an undeclared identifier, rather than allocating codes that record the wrong diagnosis.

## Cross-references

- **#1361** — `ArrayInitHelper.ts:160` and `StringDeclHelper.ts:231` appear fixture-covered by
  `tests/string-array-init/string-array-init-error-mismatch.expected.error`, which has no
  `.test.cnx` and cannot run.
- **#1277** — `CodeGenerator.ts:3517` fires on valid C-Next (`return { x: 1, y: 2 };` from a
  struct-returning function). Whether it becomes a diagnostic or disappears is that issue's call.
- **#1014–#1017** — `StringDeclHelper.ts:515/559/596` are dead only while trailing brackets are
  rejected unconditionally.
