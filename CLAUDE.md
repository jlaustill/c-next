# C-Next Project Instructions

## Critical Rules

### Correctness Over Convenience — ZERO EXCEPTIONS

**NEVER take shortcuts without explicit user permission.** This is non-negotiable.

Violations include: deleting/skipping failing tests, `--no-verify`/`--force` flags, `any` types, `@ts-ignore`, disabling lints, stubbing with no-ops, skipping validation. **If unclear or blocked — ASK the user.**

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

**ts-morph MCP tools**: `rename_filesystem_entry_by_tsmorph` (move files), `move_symbol_to_file_by_tsmorph` (extract symbols), `find_references_by_tsmorph` (find usages). Always use `dryRun: true` first. **Gotcha**: Adds `.ts` extensions to imports — remove them manually after moves.

**Layer constraints (depcruise)**: `logic/` cannot import from `output/`. Check import dependencies before choosing extraction location.

**Local MISRA validation**: `sudo apt-get install cppcheck` then `npm run validate:c`

**MISRA rule details**: `cppcheck --addon=misra -I tests/include <file.c>` shows specific rule violations (batch-validate only shows file names)

**Regenerate all snapshots**: `npm test -- --update` (after codegen changes)

**C vs C++ const linkage**: C const at file scope has external linkage; C++ const has internal linkage (needs `extern`). `CodeGenState.cppMode` controls this.

---

## Code Quality

**Pre-commit hooks handle formatting automatically.** Manual if needed: `npm run prettier:fix && npm run oxlint:check`

### SonarCloud Quality Gate

| Requirement          | Threshold        |
| -------------------- | ---------------- |
| Coverage (new code)  | >= 80%           |
| Duplicated lines     | <= 3%            |
| Cognitive complexity | <= 15 per method |
| Bugs/vulnerabilities | 0 new            |

**Before PRs**: Run `npm run unit:coverage` and check new/modified files.

**Reducing complexity**: Extract nested logic to private helpers with early returns. Check `src/utils/ExpressionUtils.ts` for existing patterns first.

**API queries**: See `https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&statuses=OPEN,CONFIRMED`

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

| Type             | Purpose                        | Status           |
| ---------------- | ------------------------------ | ---------------- |
| `TSymbol`        | New discriminated union        | Use for new code |
| `ISymbol`        | Legacy flat interface          | Being phased out |
| `TSymbolAdapter` | Converts TSymbol[] → ISymbol[] | Backwards compat |

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
- **Remaining work**: #803 (Phase 5 - migrate consumers), #804 (Phase 6 - C++/C resolvers), #805 (Phase 7 - remove legacy)

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
- **Test isolation**: Call `SymbolRegistry.reset()` in `beforeEach` for CNextResolver tests
- **Array dimensions**: `IVariableSymbol.arrayDimensions` is `(number | string)[]` — numbers for resolved constants, strings for C macros
- **Analyzer state**: `CodeGenState.buildExternalStructFields()` in Stage 2b; analyzers read via `getExternalStructFields()`
- **Analyzer symbols**: `CodeGenState.symbols` is set before `runAnalyzers()` in `_transpileFile()` — analyzers can use `isKnownEnum()`, `getStructFieldType()`, `getFunctionReturnType()`, `getVariableTypeInfo()`
- **Analyzer test isolation**: Use `CodeGenState.reset()` in `afterEach` when tests set `CodeGenState.symbols`
- **Analyzer type tracking**: Use `trackType(typeCtx, identifier)` helper pattern (see `FloatModuloAnalyzer.trackIfFloat()`, `ArrayIndexTypeAnalyzer.trackType()`) to avoid jscpd duplication across `enterVariableDeclaration`/`enterParameter`/`enterForVarDecl`
- **Ternary grammar**: `ternaryExpression` has 3 `orExpression` children: `[0]` = condition, `[1]` = true value, `[2]` = false value. When validating value types, skip index 0

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
| `// test-no-exec`        | Compile only, no execution                              |
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
- **String indexing**: Avoid `str[0] != 'H'` — transpiler generates `strcmp()`. Use `u8` arrays
- **Const array sizes**: `u32 arr[CONST_SIZE] <- [1,2,3]` fails (C VLA). Use literals with initializers
- **C++ mode**: `const T` params become `const T&` with `.` access (not pointers)
- **Helper files**: Create `.expected.h` to prevent test framework cleanup
- **Struct tests**: Need `.expected.h` alongside `.expected.c`
- **Bug reproduction**: `bugs/issue-<name>/` directories — commit with fixes for regression prevention

### Transpiler Entry Point

| Entry Point   | Purpose                                  |
| ------------- | ---------------------------------------- |
| `transpile()` | Single entry point for all transpilation |

Accepts `{ kind: 'files' }` for CLI/multi-file or `{ kind: 'source', source }` for API/single-file.
Always returns `ITranspilerResult`. `DualCodePaths.test.ts` verifies parity between both modes.
Header directive propagation is handled by `IncludeResolver.resolve()` for all include types.

---

## Code Generation

### Essential Patterns

- **expectedType**: Use `this.context.expectedType` to disambiguate (e.g., enum members)
- **Struct access**: Track `currentStructType` through member chains
- **C++ mode**: Coordinate changes in `generateParameter()`, member access, `_generateFunctionArg()`, and HeaderGenerator
- **Handler state**: Access via `CodeGenState` (properties) and `CodeGenState.generator!` (methods)
- **CodeGenState**: Sole state container — don't add instance state to CodeGenerator

### Assignment Classification (ADR-109)

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

---

## ADR Rules

**CRITICAL: NEVER change ADR status without explicit user confirmation.**

| Status      | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| Research    | Proposal under investigation — NOT established syntax |
| Accepted    | User-approved decision                                |
| Implemented | User-confirmed complete                               |
| Rejected    | Decision NOT to implement                             |

- **DO**: Update ADRs with research, context, links, findings
- **DO NOT**: Change Status or Decision without explicit approval
- **Sync order**: Update ADR file FIRST, then README.md

---

## Git Workflow

**All changes MUST go through Pull Requests.** See `CONTRIBUTING.md` for full workflow.

- Never work directly on main — create feature branch first
- Check branch: `git branch --show-current`
- Branch naming: `feature/`, `fix/`, `docs/`, `test/` + descriptive name
- Commit generated `.test.c`/`.test.h` files — they're part of the test suite
- **Never delete generated test files** or run `git restore tests/`

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
