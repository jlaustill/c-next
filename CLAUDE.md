# C-Next Project Instructions

## Git Worktrees

**NEVER use git worktrees. ZERO EXCEPTIONS.** This repo is always unique per session and won't be touched by anyone else. Work directly on the main repo.

## Starting a Task

**Always ask the user what they want to work on.** Do not assume based on the roadmap or queue.

## Before Starting an Issue

Check if work was already done: `git log --oneline --grep="<issue-number>"` — Issues may have been completed in PRs referencing different issue numbers.

### GitHub CLI Workaround

`gh issue view` may fail with Projects Classic deprecation error. Use `gh api repos/jlaustill/c-next/issues/<number>` instead.

## Workflow: Research First

1. **Always start with research/planning** before implementation
2. If unsure about approach, **ask the user**
3. Update the relevant ADR with research findings, links, and context as you go
4. **Never update ADR status or decisions without user direction**

## Code Quality Requirements

**All new and modified TypeScript code must pass linting:**

- **Automated**: Pre-commit hooks automatically run prettier and eslint on staged files
- **Manual** (if needed): `npm run prettier:fix` and `npm run oxlint:check`
- **Spell check**: When adding new packages or tools, add their names to `.cspell.json` words list
- Fix any oxlint errors in code you write or modify
- Legacy errors in untouched files can be ignored (fix as you go)
- Pre-commit hooks use `lint-staged` to only check files you're committing
- **Lint scope**: `npm run oxlint:check` only covers `src/`, not `vscode-extension/` or `scripts/`

### VS Code Extension Caveats

- **Pre-commit hooks**: The vscode-extension requires named exports (`activate`, `deactivate`) per VS Code API. Use `git commit --no-verify` when committing vscode-extension changes, as oxlint's no-named-export rule conflicts with VS Code requirements.

### Git Merge Commits

- **Pre-commit hooks during merges**: Hooks run on ALL files from both branches, not just conflict-resolved files. If unrelated files have lint issues, use `--no-verify` for the merge commit (tests must still pass).

### SonarCloud

SonarCloud runs as a required PR check. **PRs cannot merge until the SonarCloud quality gate passes.**

**Quality gate requirements for new code:**

- **Code coverage >= 80%** on new code (unit tests via vitest)
- **No new bugs** (reliability)
- **No new vulnerabilities** (security)
- **No new security issues** reviewed as unsafe
- **Duplicated lines <= 3%** on new code
- **Cognitive complexity per method <= 15** — extract sub-methods with early returns to reduce nesting

**Reducing cognitive complexity:** Extract nested logic into private helper methods with early returns. Keep helpers in the same class when they need many instance dependencies. Name helpers descriptively (e.g., `_resolveIdentifierExpression`, `_resolveUnqualifiedEnumMember`).

**After extracting helpers:** Error throw paths in extracted methods often need unit tests - integration tests may not cover them. Check `npm run unit:coverage` for uncovered lines.

**Before opening a PR**, verify coverage on new/modified files:

```bash
npm run unit:coverage
```

- **SonarCloud coverage on new code**: The quality gate requires >= 80% on new lines. Even 1 uncovered line in a small PR can fail the gate. Run `npm run unit:coverage` and check new/modified methods before pushing.
- **Widening interface return types**: When changing a return type (e.g., `{ baseType, isArray }` → `TTypeInfo`), search for ALL test mocks of that method and update them to include newly required fields. Use `Grep` for the method name across `__tests__/` directories.

Check the terminal report for files you changed — any new code below 80% coverage will fail the quality gate.

**Useful API queries:**

- **Get issue counts by rule**: `curl -s "https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&statuses=OPEN,CONFIRMED&facets=rules&ps=1" | jq '.facets[0].values'`
- **Get open issues**: `curl -s "https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&statuses=OPEN,CONFIRMED&ps=100" | jq '.issues[] | {rule, message, component}'`
- **Get cognitive complexity issues**: `curl -s "https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&statuses=OPEN,CONFIRMED&rules=typescript:S3776&ps=100" | jq '.issues[] | {message, component, line}'`

### Flaky CI Tests

- **Transpiler.coverage.test.ts** can timeout in CI (5s limit). Re-run with `gh run rerun <run-id> --failed`

### CSpell (Spelling Check)

- **Run manually**: `npm run cspell:check` (runs automatically on push)
- **Naming convention**: Use camelCase for compound words (e.g., `SubDirs` instead of lowercase) - cspell may flag all-lowercase compounds

### jscpd (Copy-Paste Detection)

- `npm run analyze:duplication` — Find code clones with token counts and file locations
- Common extraction patterns: type resolution helpers, validation helpers, code generation utilities
- Focus on clones >100 tokens for meaningful reduction
- **Inline interface duplication**: When the same inline interface appears in multiple method signatures, extract to a named interface type

### TypeScript Coding Standards

**Default exports only** - The project uses oxlint's `no-named-export` rule.

**No re-exports/barrel files** - Don't create `index.ts` files that re-export (violates `no-named-export` rule). Import directly from source files.

**Static classes for utilities** - Use static classes (not object literals) for modules with multiple related functions:

```typescript
// ✅ Correct
class TestUtils {
  static normalize(str: string): string { ... }
  static validate(file: string): IResult { ... }
}
export default TestUtils;
```

**No singleton instance exports** - Don't instantiate and export class instances:

```typescript
// ❌ Wrong - singleton (knip can't detect unused methods)
class Registry { private map = new Map(); register() { ... } }
export default new Registry();

// ✅ Correct - static class
class Registry { private static map = new Map(); static register() { ... } }
export default Registry;
```

**Readonly Map restoration** - Can't reassign `readonly` Map properties. Use `map.clear()` then `for (const [k, v] of saved) map.set(k, v)` to restore state.

**Edit tool `replace_all` gotcha** - When using `replace_all: true`, the replacement happens iteratively. If your `new_string` contains text that matches `old_string`, you'll get double-replacement (e.g., replacing `Foo` with `Bar.Foo` using `replace_all` results in `Bar.Bar.Foo`). Use targeted single replacements instead.

**No destructuring** - Always use the class name prefix for self-documenting code:

```typescript
// ✅ Correct - self-documenting
TestUtils.normalize(actualErrors) === TestUtils.normalize(expectedErrors);

// ❌ Wrong - obscures origin
const { normalize } = TestUtils;
normalize(actualErrors) === normalize(expectedErrors);
```

**Shared types in `/types` directories** - One interface per file with default export:

```
src/transpiler/types/IFileResult.ts
scripts/types/ITools.ts
```

See `CONTRIBUTING.md` for complete TypeScript coding standards.

### 3-Layer Architecture (PR #571, #572)

The codebase is organized into three layers under `src/transpiler/`:

- `src/transpiler/data/` — Discovery layer (FileDiscovery, IncludeResolver, DependencyGraph)
- `src/transpiler/logic/` — Business logic (parser/, symbols/, analysis/, preprocessor/)
- `src/transpiler/output/` — Generation (codegen/, headers/)
- `src/transpiler/Transpiler.ts` — Orchestrator (coordinates all layers)
- `src/utils/` — Shared utilities (constants/, cache/, types/)

### ANTLR Parser Generation

- ANTLR preserves input path structure: `-o src/transpiler/logic/parser grammar/CNext.g4` → `src/transpiler/logic/parser/grammar/`
- Grammar directories excluded from prettier/oxlint via ignore patterns
- `npm run antlr` — C-Next grammar, `npm run antlr:all` — All grammars (C-Next, C, C++)

### Symbol Resolution Architecture (ADR-055)

**Use the composable collectors** in `src/transpiler/logic/symbols/cnext/`:

- `CNextResolver.resolve(tree, file)` → `TSymbol[]` (discriminated union)
- `TSymbolAdapter.toISymbols(tSymbols, symbolTable)` → `ISymbol[]` (for SymbolTable)
- `TSymbolInfoAdapter.convert(tSymbols)` → `ISymbolInfo` (for CodeGenerator)

**Do NOT use** the deleted legacy collectors:

- ~~`SymbolCollector`~~ (was in transpiler/output/codegen/)
- ~~`CNextSymbolCollector`~~ (was in transpiler/logic/symbols/)

**TypeUtils.getTypeName()** must preserve string capacity (return `string<32>` not `string`) for CodeGenerator validation.

### Symbol Resolution Type Patterns

- **Array dimensions**: `IVariableSymbol.arrayDimensions` is `(number | string)[]` - numbers for resolved constants, strings for C macros from headers
- **C macro pass-through**: Unresolved array dimension identifiers (e.g., `DEVICE_COUNT` from included C headers) pass through as strings to generated headers

### Const Inference Architecture

- **walkStatementForModifications()** uses two helper methods (issue #566 refactoring):
  - `collectExpressionsFromStatement()` - returns all expressions from any statement type
  - `getChildStatementsAndBlocks()` - returns child statements/blocks for recursion
- **Adding new statement types**: Update both helpers - they serve as checklists for expression contexts and child statements

### Parser Keyword Tokens

- **Keyword tokens vs IDENTIFIER**: Keywords like `this`, `global` are separate tokens, not IDENTIFIERs. Use `ctx.THIS()` not `ctx.IDENTIFIER()?.getText() === "this"` - the latter returns undefined.

### AST Navigation Patterns

- **Function declarations**: Use `functionDeclaration()` not `functionDefinition()` — the C-Next grammar uses "declaration" terminology
- **Expression unwrapping**: Use `ExpressionUnwrapper` utility in `src/transpiler/output/codegen/utils/` for drilling through expression hierarchy (ternary → or → and → ... → postfix)

### Code Generation Patterns

- **Type-aware resolution**: Use `this.context.expectedType` in expression generators to disambiguate (e.g., enum members). For member access targets, walk the struct type chain to set `expectedType`.
- **Nested struct access**: Track `currentStructType` through each member when processing `a.b.c` chains.
- **C++ mode struct params**: Changes to `cppMode` parameter handling require coordinated updates in THREE places: (1) `generateParameter()` for signature, (2) member access at ~7207 and ~8190 for `->` vs `.`, (3) `_generateFunctionArg()` for `&` prefix. Also update HeaderGenerator via IHeaderOptions.cppMode.
- **Struct param access helpers**: Use `memberAccessChain.ts` helpers for all struct parameter access patterns: `getStructParamSeparator()` for `->` vs `.`, `wrapStructParamValue()` for `(*param)` vs `param`, `buildStructParamMemberAccess()` for member chains. Never inline these patterns in CodeGenerator.
- **buildHandlerDeps() delegation**: Methods in `buildHandlerDeps()` should delegate to canonical CodeGenerator methods (e.g., `this.isKnownScope(name)` not `this.symbols!.knownScopes.has(name)`) to get full SymbolTable + C-Next symbol lookup. Hand-rolling lookups bypasses C header struct/scope support.
- **Adding generator effects**: To add a new include/effect type (e.g., `irq_wrappers`):
  1. Add to `TIncludeHeader` union in `src/transpiler/output/codegen/generators/TIncludeHeader.ts`
  2. Add `needs<Effect>` boolean field in `CodeGenerator.ts` (with reset in generate())
  3. Handle effect in `processEffects()` switch statement
  4. Generate output in `assembleOutput()` where other effects are emitted

### Adding CLI Flags

When adding a new CLI flag that affects code generation, update all layers:

1. `src/index.ts` — Parse the argument and compute `final<Flag>` value
2. `src/index.ts` — Pass to `Transpiler` constructor
3. `src/transpiler/types/ITranspilerConfig.ts` — Add to interface

### Error Messages

- Use simple `Error: message` format (not `Error[EXXX]`) — matches 111/114 existing errors.

## Testing Requirements

**Tests are mandatory for all feature work:**

1. Create test files in `tests/` directory as you implement
2. Verify transpiled output compiles cleanly with `npm run analyze`
3. Run tests before considering a task complete

**Test Commands:**

- `npm test` — Run C-Next integration tests (.test.cnx files)
- `npm run test:q` — Quiet mode (errors + summary only, ideal for AI)
- `npm test -- tests/enum` — Run specific directory
- `npm test -- tests/enum/my.test.cnx` — Run single test file (multiple files: use directory pattern instead)
- `npm run unit` — Run TypeScript unit tests (vitest)
- `npm run unit -- <path>` — Run specific unit test file
- `npm run unit:coverage` — Run unit tests with coverage report
- `npm run test:all` — Run both test suites
- `npm test -- <path> --update` — Generate/update `.expected.c` snapshots for new tests
- Tests without `.expected.c` snapshots are **skipped** (not failed) — use `--update` to generate initial snapshot

### Test Architecture

- **`npm test`** — Tests transpilation via `Transpiler.transpileSource()` API (parallelized, fast)
- **`npm run test:cli`** — Tests CLI behavior via subprocess in `scripts/test-cli.js` (flags, exit codes, file I/O)
- CLI-specific features (PlatformIO detection, `--target` flag) need `test:cli` tests, not `npm test`

### Unit Test File Location

Place TypeScript unit tests in `__tests__/` directories adjacent to the module:

- `src/utils/cache/CacheManager.ts` → `src/utils/cache/__tests__/CacheManager.test.ts`
- `src/utils/cache/CacheKeyGenerator.ts` → `src/utils/cache/__tests__/CacheKeyGenerator.test.ts`

### Unit Test Parser Imports

- **Parser type namespace**: Use `import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser.js"` to access types like `Parser.StatementContext`
- **Direct parsing in tests**: Use `CNextSourceParser.parse(source)` instead of `new Transpiler()` when you just need the AST - Transpiler requires inputs configuration

### Cross-File Testing

- **Symbol resolution features** (enums, structs, types): Always test with symbols defined in included files, not just same-file
- Create helper `.cnx` files (e.g., `test-types.cnx`) alongside test files for cross-file scenarios
- The original bug scenario often involves `#include` - reproduce that exactly

### Bug Reproduction Files

- `bugs/issue-<name>/` directories contain minimal reproduction cases from GitHub issues
- **Commit these with fixes** - they serve as additional regression prevention
- Regenerate after fix to show corrected output

### Test File Patterns

There are **two types of tests** in C-Next:

#### 1. Compilation Tests (No Validation)

Tests that verify code transpiles and compiles correctly. **NO** result validation needed.

```cnx
// Test all operations (NO test-execution comment)
// Note: No // test-execution marker

f32 result;

void test_operations() {
    f32 a <- 10.5;
    result <- a + 5.0;  // Just assign, no validation
    result <- a * 2.0;
}

void main() {
    test_operations();
}
```

**Examples**: `tests/floats/float-arithmetic.test.cnx`, `tests/floats/float-comparison.test.cnx`

#### 2. Execution Tests (With Validation) ⭐ **MOST TESTS**

Tests marked with `// test-execution` that **execute and validate results**. These **MUST validate every operation**.

```cnx
// test-execution
// Tests: description of what is being validated

u32 main() {
    // Perform operation
    u64 result <- 1000 + 500;

    // ALWAYS validate result
    if (result != 1500) return 1;  // Return error code on failure

    // Test another operation
    result <- 1000 - 200;
    if (result != 800) return 2;   // Different error code

    // ... more tests with incrementing error codes ...

    return 0;  // Success - ALL validations passed
}
```

**Key Requirements for Execution Tests**:

- **MUST** include `// test-execution` comment at top
- **MUST** validate EVERY result with `if (result != expected) return N;`
- **MUST** use unique return codes (1, 2, 3, ...) for each validation
- Return 0 **ONLY** if all validations pass
- Include comments explaining what each test validates

**Examples**:

- `tests/arithmetic/u64-arithmetic.test.cnx` (34 validations)
- `tests/comparison/u64-comparison.test.cnx` (50 validations)
- `tests/ternary/ternary-u64.test.cnx`
- `tests/array-initializers/u64-array-init.test.cnx` (31 validations)

### Common Mistakes to Avoid

❌ **WRONG** - Execution test without validation:

```cnx
// test-execution
u32 main() {
    u64 result <- 1000 + 500;
    return 0;  // BUG: Always passes, never validates!
}
```

✅ **CORRECT** - Execution test with validation:

```cnx
// test-execution
u32 main() {
    u64 result <- 1000 + 500;
    if (result != 1500) return 1;  // Validation required!
    return 0;
}
```

### C-Next Test Gotchas

- **String character indexing**: Avoid `myString[0] != 'H'` — transpiler incorrectly generates `strcmp()`. Use `u8` arrays for character-level access.
- **Const as array size with initializer**: `u32 arr[CONST_SIZE] <- [1,2,3]` fails because C treats `const` as runtime variable (VLA). Use literal sizes with initializers.
- **C++ mode uses references**: In C++ mode, `const T` struct params become `const T&` (reference) with `.` member access and direct argument passing. In C mode, they become `const T*` (pointer) with `->` and `&` prefix.
- **Struct tests need expected headers**: Tests using struct types require `.expected.h` files alongside `.expected.c` to prevent header deletion by test framework.

### Test Framework Internals

- **Fresh Transpiler per helper**: When transpiling helper .cnx files in tests, use a fresh `new Transpiler()` instance for each to avoid symbol pollution from accumulated symbols
- **Helper header validation**: Helper .cnx files can have `.expected.h` files for header validation (same pattern as `.expected.c`)
- **Prevent helper cleanup**: Create `.expected.h` for helper `.cnx` files to prevent test framework from deleting generated `.h` files needed by other tests
- **Auto-generating helper snapshots**: `npm test -- <path> --update` creates `.expected.h` for helper `.cnx` files; helper `.h` files must also be committed for CI
- **Worker debug output**: `console.log` in `test-worker.ts` doesn't appear (forked process). Use `--jobs 1` for sequential mode, but note `test.ts` has duplicated logic
- **Assignment handler imports**: Import `AssignmentHandlerRegistry` from `assignment/index` (not `handlers/index`) to ensure handlers are registered
- **Testing error paths with enums**: Use fake values (e.g., `9999 as AssignmentKind`) to test unregistered handler errors

### Error Validation Tests (test-error pattern)

For compile-time error tests in `tests/analysis/`:

- Use `// test-error` marker at top of `.test.cnx` file
- Create matching `.expected.error` file with exact error output
- Error format: `line:column error[CODE]: message` (no "Error: " prefix)
- Code generation errors: `1:0 Code generation failed: Error[CODE]: message`
- **Gotcha**: Avoid `/*` or `//` in test description comments - triggers MISRA 3.1 validation

## Header Generation

**Test `.expected.h` files**: The test framework validates `.expected.h` files when present. Create one alongside `.expected.c` for header generation tests.

### Transpiler Code Paths

**Issue #634 Consolidation**: The dual code paths have been consolidated. Both `run()` and `transpileSource()` standalone now use the same symbol collection timing (symbols collected BEFORE code generation).

The Transpiler has two entry points with unified behavior:

- **`run()`** — CLI entry point, processes files with full symbol resolution across includes
- **`transpileSource()`** — Test framework entry point, single-file transpilation (or called by `run()` with context)

When `run()` calls `transpileSource()` with a context, it passes a pre-populated symbol table. When `transpileSource()` is called standalone (no context), it builds its own context via `StandaloneContextBuilder`.

**Testing cross-file features**: Both paths should produce identical output for the same input. The `DualCodePaths.test.ts` suite verifies this parity.

## Task Completion Requirements

**A task is NOT complete until all relevant documentation is updated:**

- `README.md` — Must reflect any new features, syntax, or ADR status changes
- `docs/decisions/adr-*.md` — Relevant ADR must be created/updated
- `docs/learn-cnext-in-y-minutes.md` — Must include examples of new syntax/features
- Memory bank is updated

If implementing a feature, all documents must be current and memory must be updated before the task is done.

## ADR Status Rules

**CRITICAL: NEVER change an ADR status without explicit user confirmation.**

- ADR status values: Research, Accepted, Implemented, Rejected
- An ADR is not "Accepted" until the user explicitly accepts it
- An ADR is not "Implemented" until the user confirms implementation is complete
- Always ask before changing status, no exceptions
- **DO** update ADRs with research, context, links, and findings
- **DO NOT** change Status or Decision sections without explicit approval

**Documentation Sync Order:**

- When moving an ADR to "Implemented", update the ADR file FIRST, then update README.md
- Never move an ADR to "Implemented" in README.md before updating the ADR file itself
- This prevents README and ADR files from getting out of sync

## ADR Reference Rules

**Only use Implemented or Accepted ADRs as examples of C-Next syntax/patterns.**

- **Research** ADRs are proposals under investigation — NOT established syntax
- **Rejected** ADRs document decisions NOT to implement something
- Never cite Research ADRs as examples of "how C-Next does X"
- When exploring syntax patterns, check the ADR status first

## Generated Test Files

**Always commit generated test output files.** When running tests or the transpiler on `.test.cnx` files:

- `.test.c` and `.test.h` files are generated alongside `.test.cnx` files
- These generated files **MUST be committed** to the repository
- They serve as additional validation that the transpiler output is correct
- **NEVER delete generated test files** - they are part of the test suite
- **NEVER run `git restore tests/`** to revert generated files

## Pull Request Workflow

**All changes to main MUST go through Pull Requests. NEVER push directly to the main branch.**

- **NEVER work directly on the main branch** - always create/checkout a feature branch before starting work
- Check current branch with `git branch --show-current` before making changes
- Create feature branches with descriptive names (e.g., `feature/add-loop-tests`, `fix/parser-bug`)
- After committing to a feature branch, push the branch and create a PR
- All merges to main must be reviewed via Pull Request
- Use the `/commit-push-pr` skill or `git push` + `gh pr create` to push and create PRs
- If the user says "commit this", only commit - ask before pushing

## Development Tips

**Testing local changes**: Use `npx tsx src/index.ts <file.cnx>` instead of the global `cnext` binary to test uncommitted transpiler changes.

**Testing C++ mode**: Use `npx tsx src/index.ts <file.cnx> --cpp` to test C++ output mode (generates `.cpp` files with reference semantics for struct params).

## Code Analysis Tools

**Dead code and unused exports:**

- `npx knip` — Find unused files, exports, and dependencies (config: `knip.json`)
- `npx knip --include classMembers` — Find unused class methods (many false positives from generated parser files)
- `npm run analyze:prune` — Find exported functions/classes not imported anywhere (ts-prune)
- `parseWithSymbols.ts` is a public API entry point (used by vscode-extension)
- **Singleton limitation**: knip can't detect unused methods on exported class instances — use static classes instead

**Code duplication:**

- `npm run analyze:duplication` — Find copy-paste code with jscpd (config: `.jscpd.json`). Output shows "duplicated lines" (percentage) and "duplicated tokens" (percentage) — both metrics matter for SonarCloud
- `npm run duplication:sonar` — Query SonarCloud for duplication metrics
- `npm run analyze:cpd` — PMD Copy-Paste Detector (requires Java 11+)

**Dependency analysis:**

- `npm run analyze:madge` — Check for circular dependencies
- `npm run analyze:madge:graph` — Generate dependency visualization (requires Graphviz)
- `npm run depcruise` — Validate architecture rules with dependency-cruiser

**Run all analysis:**

- `npm run analyze:all` — Run duplication, prune, and madge checks together

**Note:** Circular dependencies in `parser/grammar/` are expected (ANTLR-generated code)

## Release Checklist

**See [`releasing.md`](releasing.md) for the complete release process.**

Quick reference for VS Code extension updates (if grammar changed):

1. **Regenerate parser** if grammar changed: `npm run antlr`
2. **Update VS Code extension** (`vscode-extension/`):
   - Sync `tmLanguage.json` with any new keywords, types, or syntax
   - Sync `completionProvider.ts` keywords with actual C-Next keywords
   - Bump version in `package.json`
3. **Rebuild and test extension**:
   ```bash
   cd vscode-extension
   npm run compile
   npx vsce package --allow-missing-repository
   code --install-extension c-next-*.vsix --force
   ```
4. **Verify** syntax highlighting and autocompletion work for new features
