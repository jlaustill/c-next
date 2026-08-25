# C-Next Project Instructions

## Critical Rules

> **The C-Next way** is captured as a skill: `.claude/skills/cnext-way/SKILL.md`
> (`/cnext-way`). Read it before implementing, and again before calling work done —
> it carries the verification discipline these rules depend on.

### Correctness Over Convenience — ZERO EXCEPTIONS

**NEVER take shortcuts without explicit user permission.** This is non-negotiable.

Violations include: deleting/skipping failing tests, `--no-verify`/`--force` flags, `any` types, `@ts-ignore`, disabling lints, stubbing with no-ops, skipping validation. **If unclear or blocked — ASK the user.**

### Bug Tracking — ZERO EXCEPTIONS

**NEVER sweep bugs under the rug.** When a bug is discovered, it MUST be either:

1. **Fixed** — resolve the issue immediately, OR
2. **Tracked** — file a GitHub issue with clear reproduction steps

There are NO exceptions. Do not ignore, dismiss, or defer bugs without creating an issue. Pre-existing bugs found during other work still require tracking.

### No Duplicate Code Paths — ZERO EXCEPTIONS

**NEVER create or perpetuate duplicate code paths.** If changing something in one place requires a corresponding change in another place, that is a bug in the architecture. Fix it immediately.

**This applies whether the duplication is newly introduced OR pre-existing — if you touch code containing a duplicate path, you fix it.** "It pre-dates this change," "it follows an existing pattern," and "it's really just a misleading comment" are NOT reasons to defer, downgrade, or merge around it. Touching it means owning it.

- If two interfaces need the same fields, extract a shared type or push the data onto the shared model (e.g., `IParameterSymbol`)
- If two code paths must produce identical output, they MUST share the same logic — not copy it
- When fixing a bug caused by divergent paths, **unify the paths** rather than patching both independently
- **Single source of truth means the _decision_, not just the data.** Sharing one detection function (or setting one flag on a shared model) is NOT enough if each path then re-derives the _consequences_ independently. Paths that agree only "by coincidence" — e.g. because some unrelated predicate currently happens to hold — are a latent divergence, not a unified path
- **Example (Issue #914):** `.c` and `.h` generation had separate callback-handling logic. The fix resolved callback info ONCE onto `IParameterSymbol`, eliminating the duplicate path entirely

Having to update something in 2 places instead of 1 is the WORST anti-pattern in this project. When you find it, fix it.

### C-Next Syntax Changes — ZERO EXCEPTIONS

**NEVER change C-Next language syntax or behavior without explicit ADR approval and user confirmation.** This is absolutely non-negotiable.

- C-Next syntax MUST always follow the ADRs exactly
- If there is any ambiguity about syntax behavior, **ASK the user for direction**
- NEVER assume a syntax change is acceptable, even as a "beneficial side effect"
- NEVER introduce behavioral changes that affect what C-Next code compiles or how it compiles
- Test files marked `// test-error` define expected behavior — changing them to pass is a syntax change

**Example (Issue #872):** Setting `expectedType` for MISRA compliance accidentally enabled bare enum resolution in function arguments. This was reverted because it changed C-Next behavior without ADR approval. The fix added `suppressBareEnumResolution` to get MISRA compliance without changing syntax behavior.

When in doubt: **ASK.** Syntax changes require ADR discussion and user approval.

### Project Hygiene

- No root-level analysis artifacts (`*.csv`, `*-report.md`) — use terminal or `docs/`
- `.auto-claude-status` is gitignored
- **NEVER use git worktrees** — work directly on the repo

### Starting a Task

**Always ask the user what to work on.** Check if issue was already done: `git log --oneline --grep="<issue-number>"`

**Before implementing plan findings**: Verify findings are current, search before removing "unused" code, check if state is file-specific.

### Workflow: Research First

1. **Always start with research/planning** before implementation
2. If unsure about approach, **ask the user**
3. Update the relevant ADR with research findings, links, and context as you go
4. **Never update ADR status or decisions without user direction**

---

## Quick Reference

| Task               | Command                                 |
| ------------------ | --------------------------------------- |
| Build transpiler   | `npm run build`                         |
| Integration tests  | `npm test` or `npm run test:q` (quiet)  |
| Single test        | `npm test -- tests/dir/file.test.cnx`   |
| Unit tests         | `npm run unit`                          |
| Coverage           | `npm run unit:coverage`                 |
| C static analysis  | `npm run validate:c`                    |
| All tests + checks | `npm run test:all`                      |
| Local transpiler   | `npx tsx src/index.ts <file.cnx>`       |
| C++ mode           | `npx tsx src/index.ts <file.cnx> --cpp` |
| Generate snapshots | `npm test -- <path> --update`           |
| ANTLR regenerate   | `npm run antlr`                         |

**GitHub CLI**: `gh issue view` may fail — use `gh api repos/jlaustill/c-next/issues/<number>` instead.

**ts-morph MCP tools (PREFER FOR REFACTORING)**: Use ts-morph MCP tools as the **first choice** for TypeScript refactoring operations:

- `rename_symbol_by_tsmorph` — rename functions/variables/classes across project
- `rename_filesystem_entry_by_tsmorph` — move/rename files with import updates
- `move_symbol_to_file_by_tsmorph` — extract symbols to new/existing files
- `find_references_by_tsmorph` — find all usages before refactoring

**Always use `dryRun: true` first.** Gotcha: May add `.ts` extensions to imports — remove them manually after moves.

**Layer constraints (depcruise)**: `logic/` cannot import from `output/`. Check import dependencies before choosing extraction location.

**Local MISRA validation**: `sudo apt-get install cppcheck` then `npm run validate:c`

**MISRA rule details**: `cppcheck --addon=misra -I tests/include <file.c>` shows specific rule violations (batch-validate only shows file names)

**Transpiler failures**: `npx tsx src/index.ts` prints `Error:` (capital E) and exits non-zero —
detect with the exit code. `grep -q error` silently misses every diagnostic.

**Mismatch masks execution**: a fixture failing `C output mismatch` never runs, so behavioral
regressions only surface _after_ `npm run test:update`. Re-run the suite post-regeneration before
calling a codegen change behavior-preserving.

**Snapshot updates**: `.expected.*` files are rewritten **only** under `--update`. A plain
`npm test` regenerates transpiler output (`.test.c/.h/.cpp/.hpp`) and _compares_ it against the
snapshots — it never edits them. That is why `test:all` is a gate and must never include an
update step: an `--update` inside it could not fail on a mismatch. `npm run test:update`
regenerates every snapshot, `tests/bugs/` included (#1142); `npm run test:bugs:update` narrows
it to the regression fixtures.

**C vs C++ const linkage**: C const at file scope has external linkage; C++ const has internal linkage (needs `extern`). `CodeGenState.cppMode` controls this.

---

## Code Quality

**Pre-commit hooks handle formatting automatically.** Manual if needed: `npm run prettier:fix && npm run oxlint:check`

### SonarCloud — Never Merge a New Issue — ZERO EXCEPTIONS

**A PR that introduces ANY new SonarCloud issue does not merge, whatever the
quality gate says.** Not one Code Smell, not one Minor, not "it's only a test
file."

**The gate passing is NOT the standard.** The gate scores _ratings_ on new code,
so a handful of new Code Smells can land while it still reports OK. Reading a
green gate as permission to merge is the mistake — check the issue list, not the
gate:

```
# issues introduced by a PR (must report total 0 before merge)
# statuses= is REQUIRED: without it the response also lists CLOSED/FIXED issues,
# so a PR whose issues you already fixed still reports a non-zero total.
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&pullRequest=<PR>&statuses=OPEN,CONFIRMED,REOPENED&ps=100"

# and the gate, which is necessary but NOT sufficient
curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=jlaustill_c-next&pullRequest=<PR>"
```

**A moved file re-attributes its issues to the mover.** Relocating a file makes
its pre-existing issues count as new code. "It was already there" is not an
out — if the PR moved it, the PR owns it.

**Fix the clusters you create, not just the ones reported.** If a PR adds tests
in the shape SonarCloud flags (S5976 parameterized-test clusters are the common
one), convert them in the same PR rather than waiting for the next scan to
report them.

Resolving an issue means fixing the code. Marking it Won't Fix or False Positive
to clear the list requires explicit user approval, the same as any other
shortcut.

### SonarCloud Quality Gate

| Requirement          | Threshold                                      |
| -------------------- | ---------------------------------------------- |
| Coverage (new code)  | >= 80%                                         |
| Duplicated lines     | <= 3%                                          |
| Cognitive complexity | <= 15 per method                               |
| Bugs/vulnerabilities | 0 new                                          |
| **New issues**       | **0 — blocks merge regardless of gate status** |

**Before PRs**: Run `npm run unit:coverage` and check new/modified files.

**Reducing complexity**: Extract nested logic to private helpers with early returns. Check `src/utils/ExpressionUtils.ts` for existing patterns first.

**Generated Markdown**: format the generator's output through Prettier before writing or diffing —
the pre-commit hook formats staged `.md`, so unformatted output makes the committed file
permanently differ from what the generator produces. Emit no timestamp (it churns every run and
makes a diff gate useless — see `GRAMMAR-COVERAGE.md`, #1150). **Verify Clean runs no generators**
(it only re-downloads build artifacts), so gate generated docs in the `lint` job instead.

**API queries**: `https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&statuses=OPEN,CONFIRMED`
— add `&pullRequest=<n>` for PR-scoped issues, and
`api/qualitygates/project_status?projectKey=jlaustill_c-next&pullRequest=<n>` for the gate.

### Other Tools

| Tool          | Command                       |
| ------------- | ----------------------------- |
| Spelling      | `npm run cspell:check`        |
| Duplication   | `npm run analyze:duplication` |
| Dead code     | `npx knip`                    |
| Circular deps | `npm run analyze:madge`       |
| All analysis  | `npm run analyze:all`         |

---

## TypeScript Standards

**See `CONTRIBUTING.md` for full guide.** Key rules:

- **Default exports only** (oxlint `no-named-export` rule)
- **Static classes** for utilities, not object literals or singletons
- **No destructuring** — use `ClassName.method()` for self-documenting code
- **No re-exports/barrel files** — import directly from source
- **Composition over inheritance** — never use class inheritance
- **Shared types** in `/types` directories, one interface per file

### Static Class Pattern

```typescript
// ✅ Correct - static class
class TestUtils {
  static normalize(str: string): string { ... }
  static validate(file: string): IResult { ... }
}
export default TestUtils;

// ❌ Wrong - singleton (knip can't detect unused methods)
class Registry { private map = new Map(); register() { ... } }
export default new Registry();
```

### Common Gotchas

- **`replace_all` tool**: Iterative replacement can cause double-substitution
- **Readonly Map restore**: Use `map.clear()` + loop, not reassignment
- **Dead code**: Use TypeScript "declared but never read" diagnostics

---

## Architecture

### 4-Layer Structure (`src/transpiler/`)

| Layer        | Path            | Purpose                                                      |
| ------------ | --------------- | ------------------------------------------------------------ |
| Data         | `data/`         | Discovery (FileDiscovery, IncludeResolver, DependencyGraph)  |
| Logic        | `logic/`        | Business logic (parser/, symbols/, analysis/, preprocessor/) |
| Output       | `output/`       | Generation (codegen/, headers/)                              |
| State        | `state/`        | Global state (CodeGenState, SymbolRegistry)                  |
| Constants    | `constants/`    | Runtime lookups (BITMAP_SIZE, BITMAP_BACKING_TYPE)           |
| Orchestrator | `Transpiler.ts` | Coordinates all layers                                       |

### Utility Locations

| Type                                                        | Location                    |
| ----------------------------------------------------------- | --------------------------- |
| Type utilities (`ScopeUtils`, `TTypeUtils`, `TypeResolver`) | `src/utils/`                |
| Type definitions (interfaces, enums)                        | `src/transpiler/types/`     |
| Stateful classes (`CodeGenState`)                           | `src/transpiler/state/`     |
| Runtime lookups                                             | `src/transpiler/constants/` |

---

## Symbol Resolution (ADR-055)

### Symbol Types

| Type             | Purpose                        | Status            |
| ---------------- | ------------------------------ | ----------------- |
| `TSymbol`        | New discriminated union        | Use for new code  |
| `ISymbol`        | Legacy flat interface          | Removed (Phase 7) |
| `TSymbolAdapter` | Converts TSymbol[] → ISymbol[] | Removed (Phase 7) |

**Use**: `CNextResolver.resolve(tree, file)` → `TSymbol[]`
**Avoid**: Deleted `SymbolCollector`, `CNextSymbolCollector`

### C/C++ Resolvers (ADR-055 Phase 6)

| Resolver      | Location                     | Returns        |
| ------------- | ---------------------------- | -------------- |
| `CResolver`   | `logic/symbols/c/index.ts`   | `TCSymbol[]`   |
| `CppResolver` | `logic/symbols/cpp/index.ts` | `TCppSymbol[]` |

- **Composable collector pattern**: Static classes with `collect()` (StructCollector, EnumCollector, etc.)
- **C/C++ symbols use string types**: Unlike C-Next's `TType`, pass through unchanged
- **TAnySymbol**: Cross-language union (`TSymbol | TCSymbol | TCppSymbol`)
- **Adapters**: `CTSymbolAdapter`, `CppTSymbolAdapter` convert to legacy `ISymbol[]`

### Enum `expectedType` Contexts

| Works (bare members)                     | Requires qualified (`EnumType.MEMBER`)         |
| ---------------------------------------- | ---------------------------------------------- |
| Variable declarations: `EColor c <- RED` | Comparisons: `cfg.pType != EPressureType.PSIA` |
| Same-file struct field assignments       | Function arguments                             |
| Return statements (enum return type)     | Array dimensions: `u8[EColor.COUNT]`           |
| Struct field inits: `{color: RED}`       | Cross-file struct assignments                  |
| Switch cases, ternary arms               |                                                |

### Enum Error Locations (E0424 "not defined; did you mean")

| Location                                               | Context                                     |
| ------------------------------------------------------ | ------------------------------------------- |
| `ControlFlowGenerator.rejectUnqualifiedEnumInReturn()` | Return statements with non-enum return type |
| `SwitchGenerator.rejectUnqualifiedEnumMember()`        | Switch cases with non-enum switch type      |
| `CodeGenerator._resolveUnqualifiedEnumMember()`        | All other contexts (comparisons, args)      |

### Key Patterns

- **SymbolTable ownership**: `CodeGenState.symbolTable` is single owner
- **TSymbols use bare names**: `name: "init"` with `scope: IScopeSymbol` reference
- **Lookup key by layer**: `getOverloads(bareName)` answers "what does `init` mean _here_?" and needs ADR-057 scope context; `getOverloadsByCName("Motor__init")` answers "which symbol _is_ this?" and is an exact canonical identity. Codegen and anything downstream of it holds the latter — asking the bare-name index with a transpiled C name returns empty for every scoped symbol, which reads as "no such symbol" rather than "wrong question" (#1139). Build the key with `ScopeUtils.getTranspiledCName()`, the single encoder; never re-derive a qualified name by hand
- **Test isolation**: Call `SymbolRegistry.reset()` in `beforeEach` for CNextResolver tests
- **Array dimensions**: `IVariableSymbol.arrayDimensions` is `(number | string)[]` — numbers for resolved constants, strings for C macros
- **Analyzer state**: `CodeGenState.buildExternalStructFields()` in Stage 2b; analyzers read via `getExternalStructFields()`
- **Analyzer symbols**: `CodeGenState.symbols` is set before `runAnalyzers()` in `_transpileFile()` — analyzers can use `isKnownEnum()`, `getStructFieldType()`, `getFunctionReturnType()`, `getVariableTypeInfo()`
- **Analyzer test isolation**: Use `CodeGenState.reset()` in `afterEach` when tests set `CodeGenState.symbols`
- **Analyzer type tracking**: Use `trackType(typeCtx, identifier)` helper pattern (see `FloatModuloAnalyzer.trackIfFloat()`, `ArrayIndexTypeAnalyzer.trackType()`) to avoid jscpd duplication across `enterVariableDeclaration`/`enterParameter`/`enterForVarDecl`
- **Ternary grammar**: `ternaryExpression` has 3 `orExpression` children: `[0]` = condition, `[1]` = true value, `[2]` = false value. When validating value types, skip index 0 — and address them via `orExpression()`, **never `getChild(i)`**: the condition is parenthesized, so `getChild(0)` is `(` and an index-based skip silently does nothing
- **Callback header params**: `IParameterSymbol.isCallbackPointer`/`isCallbackConst` resolved in `Transpiler.convertToHeaderSymbols()` via `TypedefParamParser` — single source of truth for both `.c` and `.h` generation
- **Scope type predicate**: `CodeGenState.isScopeType(qualifiedName)` checks if a qualified name is a known enum/struct/bitmap. Codegen sites should call `CodeGenState.qualifyScopeType(bareName)`, which binds that predicate to `currentScope` — don't re-pair the two at each site, and don't inline `knownEnums || knownStructs || knownBitmaps`.

---

## Testing

### Test Types

| Marker                   | Behavior                                                |
| ------------------------ | ------------------------------------------------------- |
| _(none)_                 | Run in BOTH C and C++ modes                             |
| `// test-c-only`         | C mode only                                             |
| `// test-cpp-only`       | C++ mode only                                           |
| `// test-execution`      | Execute and validate (MUST use `if (x != y) return N;`) |
| `// test-error`          | Expect compile error (create `.expected.error`)         |
| `// test-transpile-only` | Skip compilation entirely                               |

**Execution tests MUST validate every result** with unique return codes (1, 2, 3...). Return 0 only if ALL pass.

### File Patterns

```
foo.test.cnx          # Source
foo.expected.c        # Expected C output
foo.expected.cpp      # Expected C++ output (optional)
foo.expected.h        # Expected C header
foo.expected.error    # Expected error (if test-error)
```

**Generate C++ snapshots**: `npx tsx scripts/generate-cpp-snapshots.ts [path] [--dry-run]`

### Unit Tests

- Location: `__tests__/` adjacent to module (e.g., `src/utils/cache/__tests__/CacheManager.test.ts`)
- Parser imports: `import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser.js"`
- Direct parsing: `CNextSourceParser.parse(source)` when you just need AST
- **Mock types**: `TTypeInfo` needs `baseType`, `bitWidth`, `isArray`, `isConst`; `TParameterInfo` needs `name`, `baseType`, `isArray`, `isStruct`, `isConst`, `isCallback`, `isString`
- **IAssignmentContext changes**: Update `createMockContext` in ALL handler test files when adding fields
- **Vitest ESM mocks**: Use `vi.mock()` at top with class pattern; create `*.mocked.test.ts` for mock isolation
- **Mock static resolver**: For CResolver, use `vi.mock("path", () => ({ default: { resolve: () => mockFn() } }))`

### Gotchas

- **Cross-file testing**: Always test with symbols in included files, not just same-file
- **Scope-context matrix (#1219)**: a check that works in one context routinely fails in
  another, and the corpus does not notice — 35 of 37 error codes have **zero** cross-file
  fixtures and none has a 2+hop one. An ADR owns its matrix: declare per-cell severity in a
  `<!-- MATRIX-SEVERITY -->` table (`off` / `warn` / `error`, undeclared → `off`), mark
  fixtures with `// test-adr: 051`, and run `npm run coverage:matrix`. Occupancy is
  **derived** — the context from the diagnostic's position through the parse tree, the file
  relationship from the include graph — so never declare a cell a fixture occupies; declare
  only the obligation. `off` is the recorded claim that a cell _cannot_ exist (a division
  cannot appear in a file-scope initializer), which is why exemptions live in the ADR where
  they get reviewed. `npm run coverage:matrix:check` gates in the `lint` job and fails on an
  unoccupied `error` cell or a stale `docs/scope-context-matrix.md`
- **Presence is not proof**: a cell showing `ok` means a fixture reaches it, not that the
  fixture would **fail** if the feature broke. #1222 is exactly that — regression fixtures
  that cannot fail if the fix is reverted. Mutation-check anything you add: break the thing
  it watches and confirm it goes red
- **String comparison vs indexing**: `a = b` / `a != b` on whole `string<N>` values compiles to `strcmp` (value comparison, ADR-045). Indexing a string (`s[i]`) yields a `char` and compares as a `char` — e.g. `s[0] != 'H'` generates `s[0] != 'H'`, not `strcmp`. (Verified 2026-06-26; the prior note claiming `str[0]` generates `strcmp` was stale.)
- **Array declarations**: use prefix syntax `u32[N] arr` — C-style `u32 arr[N]` is rejected. `N` may be a literal or a `const`; the transpiler resolves consts to their value (no C VLA), so const-sized arrays are fine
- **C++ mode**: `const T` params become `const T&` with `.` access (not pointers)
- **Helper files**: Create `.expected.h` to prevent test framework cleanup
- **Struct tests**: Need `.expected.h` alongside `.expected.c`
- **Bug reproduction**: `tests/bugs/issue-<name>/` directories — commit with fixes for regression prevention. They live under `tests/` so every fixture-walking script picks them up (#1142); a top-level `bugs/` tree was invisible to `npm test`, `test:all` and `validate:c`
- **test-error stale artifacts**: a test that compiled before becoming `test-error` leaves `.test.c/.test.h` behind — `rm` them or the guard fails with "stale generated artifacts"
- **Examples are CI-guarded**: `scripts/__tests__/examples-transpile.test.ts` transpiles every `examples/**/*.cnx` during `npm run unit`
- **Orphaned snapshots**: `.expected.cpp/.hpp` beside a `// test-c-only` fixture (or `.c/.h` beside `test-cpp-only`) is never regenerated _or_ compared — 30 exist, preserving dead codegen shapes (#1149). Exclude them from any corpus-wide analysis
- **`/* test-no-warnings */`** compiles `-c -O3` (`TestUtils.validateNoWarnings`). `-Wstringop-overflow`/`-Warray-bounds` are middle-end diagnostics — under the previous `-fsyntax-only` with no `-O` they could never fire, so the marker was inert (#1143)

### Transpiler Entry Point

| Entry Point   | Purpose                                  |
| ------------- | ---------------------------------------- |
| `transpile()` | Single entry point for all transpilation |

Accepts `{ kind: 'files' }` for CLI/multi-file or `{ kind: 'source', source }` for API/single-file.
Always returns `ITranspilerResult`. `DualCodePaths.test.ts` verifies parity between both modes.
Header directive propagation is handled by `IncludeResolver.resolve()` for all include types.

---

## Code Generation

### Compliance Annotations — C-Next STANDARD

**Whenever codegen emits code whose shape is dictated by a safety standard (MISRA C:2012, DO-178C, CERT, AUTOSAR, …) rather than by the obvious/naive translation, it MUST emit an explanatory comment directly above the generated construct.** This is a C-Next standard, not optional.

The comment names the **standard + specific rule** and gives a **short WHY** (what the naive form would have done and which rule it violates):

```c
/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes (memcpy would pass incompatible pointer types: uint8_t* vs uint32_t*). */
buffer[0] = (uint8_t)(magic);
```

- **Why:** the generated C is the certification artifact. An annotation traces each non-obvious construct back to the rule that shaped it, so reviewers/auditors don't mistake it for accidental complexity.
- **Applies to** structural transformations and idiom substitutions: loop-idiom rewrites, compile-time unrolling, type-punning via unions, suppressions, etc. (Ubiquitous inline casts like a single narrowing `(uint8_t)` need not each carry a comment.)
- **Existing examples to follow:** `ControlFlowGenerator` (`forever` → Rule 14.3) and `ArrayHandlers.handleArraySlice` (slice unroll → Rule 21.15). Use the `/* <Standard> Rule <N>: <what> (<why>). */` form for consistency.
- **Format note:** use `/* … */` (house style for generated comments) and never nest `/*` inside the text (MISRA Rule 3.1).

### Essential Patterns

- **expectedType**: Use `this.context.expectedType` to disambiguate (e.g., enum members)
- **Struct access**: Track `currentStructType` through member chains
- **C++ mode**: Parameter signatures go through `ParameterSignatureBuilder.build()` — single path for both `.c` and `.h` generation. Use `CppModeHelper` for mode-specific logic
- **Handler state**: Access via `CodeGenState` (properties) and `CodeGenState.generator!` (methods)
- **CodeGenState**: Sole state container — don't add instance state to CodeGenerator

### Assignment Classification (ADR-065)

To add new patterns: (1) Add `AssignmentKind` enum, (2) Update `AssignmentClassifier`, (3) Create handler, (4) Register handler, (5) Update test count.

### Adding CLI Flags

Update: `src/index.ts` (parse + pass), `src/transpiler/types/ITranspilerConfig.ts` (interface).

### Adding Generator Effects

1. Add to `TIncludeHeader` union
2. Add `needs<Effect>` field in CodeGenerator (reset in `generate()`)
3. Handle in `processEffects()` switch
4. Generate in `assembleOutput()`

### Struct Param Access Helpers

Use `memberAccessChain.ts` helpers for all patterns: `getStructParamSeparator()` for `->` vs `.`, `wrapStructParamValue()` for `(*param)` vs `param`, `buildStructParamMemberAccess()` for chains. Never inline these.

### Function Argument Generation

**Key principle**: Ask "What does the TARGET parameter expect?" not "What is the argument?"

- If target expects pointer and arg is already pointer → pass directly
- If target expects value and arg is pointer → dereference
- Handler: `CallExprGenerator._generateCFunctionArg()` implements this logic
- Callback-promoted params (`forcePointerSemantics=true`) are already pointers matching typedef

---

## Parser & Grammar

### Key Patterns

- **Keywords are separate tokens**: Use `ctx.THIS()` not `ctx.IDENTIFIER()?.getText() === "this"`
- **Grammar rules**: `arrayType` vs `arrayDimension`, `templateType` for C++ interop
- **AST navigation**: Use `functionDeclaration()` not `functionDefinition()`
- **Expression unwrapping**: Use `ExpressionUnwrapper` utility

### After Grammar Changes

1. `npm run antlr`
2. Update `Parser.*Context` references
3. Remove dead methods (TypeScript flags "never read")
4. Update unit test mocks

### Const Inference

`walkStatementForModifications()` uses two helpers:

- `collectExpressionsFromStatement()` — returns all expressions from any statement type
- `getChildStatementsAndBlocks()` — returns child statements/blocks for recursion

Update both when adding new statement types.

---

## Cross-Scope Rules

- **Self-scope reference**: `Scope.member` inside `Scope` → error, use `this.member`
- **Global prefix**: `global.Scope.member` inside `Scope` → allowed
- **Private access**: Own scope can access via `this.` or `global.Scope.`
- **ADR-057 type qualification**: Check the _qualified_ name against `knownEnums`/`knownStructs`/`knownBitmaps`, not the bare name against `scopeMembers`. This prevents non-type scope members (functions/variables) from capturing a same-named global type at a type position.
- **Qualify only the bare `userType()` branch.** `this.T`, `global.T` and `Scope.T` state their answer in the syntax and keep their own branches. This is not a style point: once a type name is resolved to a string, `global.Mode` and a bare `Mode` are byte-identical, so anything that qualifies _after_ resolution silently rewrites `global.` references. A post-pass over resolved names cannot be made correct — qualify while the parse tree is still available.
- **Two resolution points, one decision.** Type names are resolved twice, in different layers, and both must qualify:
  - **Symbols layer** — `TypeUtils.dispatchTypeResolution()`, fed an `isScopeType` predicate threaded from `CNextResolver.resolve()`. Everything downstream (`TSymbol`, `HeaderSymbolAdapter`, the `.h`) inherits the qualified name from here and must NOT re-qualify.
  - **Codegen layer** — `CodeGenerator.getTypeName()` and friends, via `CodeGenState.qualifyScopeType()`.
- **`CNextResolver` Pass 0b** collects the qualified names of scope-declared enums/structs/bitmaps _before_ any type is resolved, so qualification does not depend on whether a type is declared above or below its use. Do not swap this for `scope.members`: that list is kind-agnostic (a function named `B` would capture global type `B`) and is still being built while collectors read it.
- **`QualifiedCName.qualifyScopeType()`**: Shared utility in `src/utils/QualifiedCName.ts`. Takes `typeName`, `currentScope`, and an `isKnownType(qualifiedName)` predicate. Call it via `CodeGenState.qualifyScopeType()` in codegen; `TypeGenerationHelper` injects the predicate through `ITypeGenerationDeps` instead, to stay unit-testable.
- **`ParameterInputAdapter.fromAST` struct detection**: `isKnownStruct` must check both the bare name AND the qualified name (`QualifiedCName.join(currentScope, typeName)`) for scope-local struct types. Without this, scope struct params get classified as pass-by-value while `mappedType` comes back qualified, causing `.c` body to use `->` on a non-pointer.

---

## ADR Rules

**CRITICAL: NEVER change ADR status without explicit user confirmation.**

| Status      | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| Research    | Proposal under investigation — NOT established syntax |
| Accepted    | User-approved decision                                |
| Implemented | User-confirmed complete                               |
| WIP         | Accepted design, implementation in progress           |
| Rejected    | Decision NOT to implement                             |
| Superseded  | Replaced by a later ADR                               |

- **DO**: Update ADRs with research, context, links, findings
- **DO NOT**: Change Status or Decision without explicit approval
- **Sync order**: Update ADR file FIRST, then README.md

### Numbering — an ADR's number band is the release it must ship in

**Never pick "the next free number."** Ask which release the decision must ship in:

| Band  | Work done during | Release gate                          |
| ----- | ---------------- | ------------------------------------- |
| `0xx` | v0.x             | All must be implemented to cut **v1** |
| `1xx` | v1.x             | All must be implemented to cut **v2** |
| `2xx` | v2.x             | All must be implemented to cut **v3** |

A band is a commitment, not a label: cutting `v(N+1)` requires every non-terminal ADR in band
`N` to be fully implemented (`Rejected` and `Superseded` are exempt). An ADR filed today but
deliberately deferred until after v1 is `1xx` work, even though it was written during v0.x.

Numbers are never reused, and changing an ADR's target release means `git mv` plus updating
every reference — including `.test.cnx` fixture comments, which ADR-043 carries into generated
output, so `npm run test:update` is required.

**Full rules and the old→new mapping table: [`docs/decisions/README.md`](docs/decisions/README.md).**

---

## Git Workflow

**All changes MUST go through Pull Requests.** See `CONTRIBUTING.md` for full workflow.

- Never work directly on main — create feature branch first
- Check branch: `git branch --show-current`
- Branch naming: `feature/`, `fix/`, `docs/`, `test/` + descriptive name
- Commit generated `.test.c`/`.test.h` files — they're part of the test suite
- **Never delete generated test files** or run `git restore tests/`
- **Never squash-merge** — always use merge commits (`gh pr merge --merge`)

---

## Documentation Checklist

A task is NOT complete until:

- [ ] `README.md` updated (if feature-visible)
- [ ] ADR updated with implementation details
- [ ] `docs/learn-cnext-in-y-minutes.md` updated (if syntax changed)
- [ ] Memory bank updated

---

## Release

See [`releasing.md`](releasing.md) for complete process.

VS Code extension updates (if grammar changed):

1. `npm run antlr`
2. Update [vscode-c-next](https://github.com/jlaustill/vscode-c-next): `tmLanguage.json`, `completionProvider.ts`
