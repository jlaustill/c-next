# C-Next Project Instructions

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
- Fix any oxlint errors in code you write or modify
- Legacy errors in untouched files can be ignored (fix as you go)
- Pre-commit hooks use `lint-staged` to only check files you're committing
- **Lint scope**: `npm run oxlint:check` only covers `src/`, not `vscode-extension/` or `scripts/`

### VS Code Extension Caveats

- **Pre-commit hooks**: The vscode-extension requires named exports (`activate`, `deactivate`) per VS Code API. Use `git commit --no-verify` when committing vscode-extension changes, as oxlint's no-named-export rule conflicts with VS Code requirements.

### SonarCloud

- **Get issue counts by rule**: `curl -s "https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&statuses=OPEN,CONFIRMED&facets=rules&ps=1" | jq '.facets[0].values'`

### TypeScript Coding Standards

**Default exports only** - The project uses oxlint's `no-named-export` rule.

**Static classes for utilities** - Use static classes (not object literals) for modules with multiple related functions:

```typescript
// ✅ Correct
class TestUtils {
  static normalize(str: string): string { ... }
  static validate(file: string): IResult { ... }
}
export default TestUtils;
```

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
src/pipeline/types/IFileResult.ts
scripts/types/ITools.ts
```

See `CONTRIBUTING.md` for complete TypeScript coding standards.

### Shared Code Organization

- `src/utils/` — Utility functions (ParserUtils, LiteralUtils, ExpressionUtils)
- `src/constants/` — Static data definitions (TypeConstants)

### Symbol Resolution Architecture (ADR-055)

**Use the composable collectors** in `src/symbol_resolution/cnext/`:

- `CNextResolver.resolve(tree, file)` → `TSymbol[]` (discriminated union)
- `TSymbolAdapter.toISymbols(tSymbols, symbolTable)` → `ISymbol[]` (for SymbolTable)
- `TSymbolInfoAdapter.convert(tSymbols)` → `ISymbolInfo` (for CodeGenerator)

**Do NOT use** the deleted legacy collectors:

- ~~`SymbolCollector`~~ (was in codegen/)
- ~~`CNextSymbolCollector`~~ (was in symbol_resolution/)

**TypeUtils.getTypeName()** must preserve string capacity (return `string<32>` not `string`) for CodeGenerator validation.

### Symbol Resolution Type Patterns

- **Array dimensions**: `IVariableSymbol.arrayDimensions` is `(number | string)[]` - numbers for resolved constants, strings for C macros from headers
- **C macro pass-through**: Unresolved array dimension identifiers (e.g., `DEVICE_COUNT` from included C headers) pass through as strings to generated headers

### Code Generation Patterns

- **Type-aware resolution**: Use `this.context.expectedType` in expression generators to disambiguate (e.g., enum members). For member access targets, walk the struct type chain to set `expectedType`.
- **Nested struct access**: Track `currentStructType` through each member when processing `a.b.c` chains.

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
- `npm test -- tests/enum/my.test.cnx` — Run single test file
- `npm run unit` — Run TypeScript unit tests (vitest)
- `npm run unit -- <path>` — Run specific unit test file
- `npm run unit:coverage` — Run unit tests with coverage report
- `npm run test:all` — Run both test suites
- `npm test -- <path> --update` — Generate/update `.expected.c` snapshots for new tests
- Tests without `.expected.c` snapshots are **skipped** (not failed) — use `--update` to generate initial snapshot

### Unit Test File Location

Place TypeScript unit tests in `__tests__/` directories adjacent to the module:

- `src/pipeline/CacheManager.ts` → `src/pipeline/__tests__/CacheManager.test.ts`
- `src/pipeline/cache/CacheKeyGenerator.ts` → `src/pipeline/cache/__tests__/CacheKeyGenerator.test.ts`

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

### Test Framework Internals

- **Fresh Pipeline per helper**: When transpiling helper .cnx files in tests, use a fresh `new Pipeline()` instance for each to avoid symbol pollution from accumulated symbols
- **Helper header validation**: Helper .cnx files can have `.expected.h` files for header validation (same pattern as `.expected.c`)

### Error Validation Tests (test-error pattern)

For compile-time error tests in `tests/analysis/`:

- Use `// test-error` marker at top of `.test.cnx` file
- Create matching `.expected.error` file with exact error output
- Error format: `line:column error[CODE]: message` (no "Error: " prefix)
- Code generation errors: `1:0 Code generation failed: Error[CODE]: message`
- **Gotcha**: Avoid `/*` or `//` in test description comments - triggers MISRA 3.1 validation

## Header Generation

**Symbol collection timing in `transpileSource()`**: When generating headers, symbol collection MUST happen AFTER `codeGenerator.generate()`. Placing it before breaks type resolution (e.g., `strlen()` becomes placeholder comments).

**Test `.expected.h` files**: The test framework validates `.expected.h` files when present. Create one alongside `.expected.c` for header generation tests.

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

## Handling Unrelated Changes

**The user often works on multiple things in parallel. Respect their work.**

- When committing, ONLY stage and commit files related to the current task
- If you see unrelated modified files in `git status`, IGNORE them completely
- **NEVER revert or checkout unrelated files** without explicit user direction
- **NEVER commit unrelated changes** as part of your work
- If unsure whether a change is related, ask the user
- Unrelated changes are the user's responsibility — don't touch them

### Generated Test Files

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

## Dead Code Detection

- `npx knip` — Find unused files, exports, and dependencies
- Config in `knip.json` — ignores vscode-extension, prettier-plugin, tests
- `parseWithSymbols.ts` is a public API entry point (used by vscode-extension)

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
