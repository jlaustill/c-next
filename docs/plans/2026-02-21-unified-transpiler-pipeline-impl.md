# Unified Transpiler Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace dual entry points (`run()` / `transpileSource()`) with a single `transpile()` method, unifying discovery, header generation, and state propagation.

**Architecture:** Create `TTranspileInput` discriminated union type. Implement `transpile()` that branches on `input.kind` for discovery, then delegates to the existing `_executePipeline()`. Merge `generateHeader()` and `generateHeaderContent()` into one method. Update all callers.

**Tech Stack:** TypeScript, Vitest, ts-morph MCP tools for cross-file renames

---

### Task 1: Create `TTranspileInput` type

**Files:**

- Create: `src/transpiler/types/TTranspileInput.ts`

**Step 1: Create the type file**

```typescript
/**
 * Input to the unified transpile() method.
 *
 * Discriminated union:
 * - { kind: 'files' } — CLI mode, discovers from config.inputs, writes to disk
 * - { kind: 'source', ... } — API mode, in-memory source, returns results as strings
 */
type TTranspileInput =
  | { readonly kind: "files" }
  | {
      readonly kind: "source";
      readonly source: string;
      readonly workingDir?: string;
      readonly includeDirs?: string[];
      readonly sourcePath?: string;
    };

export default TTranspileInput;
```

**Step 2: Verify build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```
feat: add TTranspileInput discriminated union type
```

---

### Task 2: Add `transpile()` method (alongside existing methods)

This task adds the new `transpile()` method that delegates to the existing `run()` and `transpileSource()` as a bridge. This lets us migrate callers incrementally while keeping tests green.

**Files:**

- Modify: `src/transpiler/Transpiler.ts` (add method after line 177)

**Step 1: Add `transpile()` method**

Add this method right after `run()` (after line 177), before `transpileSource()`:

```typescript
  /**
   * Unified entry point for all transpilation.
   *
   * @param input - What to transpile:
   *   - { kind: 'files' } — discover from config.inputs, write to disk
   *   - { kind: 'source', source, ... } — transpile in-memory source
   * @returns ITranspilerResult with per-file results in .files[]
   */
  async transpile(input: TTranspileInput): Promise<ITranspilerResult> {
    if (input.kind === "files") {
      return this.run();
    }

    // Source mode: wrap transpileSource() result in ITranspilerResult
    const result = this._initResult();

    try {
      await this._initializeRun();

      const pipelineInput = this._discoverFromSource(
        input.source,
        input.workingDir ?? process.cwd(),
        input.includeDirs ?? [],
        input.sourcePath ?? "<string>",
      );

      await this._executePipeline(pipelineInput, result);
      return await this._finalizeResult(result);
    } catch (err) {
      return this._handleRunError(result, err);
    }
  }
```

Add the import for `TTranspileInput` at the top of the file.

**Step 2: Verify build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Write a smoke test**

Add to the end of `src/transpiler/__tests__/Transpiler.test.ts`, inside the existing `describe` block:

```typescript
it("transpile({ kind: 'files' }) produces same output as run()", async () => {
  const transpiler = new Transpiler({
    inputs: [join(tempDir, "test.cnx")],
    includeDirs: [],
    outDir: tempDir,
  });
  writeFileSync(join(tempDir, "test.cnx"), "void main() { }");

  const result = await transpiler.transpile({ kind: "files" });
  expect(result.success).toBe(true);
  expect(result.files.length).toBeGreaterThan(0);
});

it("transpile({ kind: 'source' }) returns ITranspilerResult with files[]", async () => {
  const transpiler = new Transpiler({ inputs: [], includeDirs: [] });

  const result = await transpiler.transpile({
    kind: "source",
    source: "void main() { }",
  });
  expect(result.success).toBe(true);
  expect(result.files).toHaveLength(1);
  expect(result.files[0].code).toContain("int main");
});
```

**Step 4: Run tests**

Run: `npm run unit -- --reporter=verbose src/transpiler/__tests__/Transpiler.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```
feat: add unified transpile() method alongside run()/transpileSource()
```

---

### Task 3: Migrate production callers to `transpile()`

**Files:**

- Modify: `src/cli/Runner.ts:57`
- Modify: `src/cli/serve/ServeCommand.ts:289,320`

**Step 1: Update Runner.ts**

At line 57, change:

```typescript
const result = await pipeline.run();
```

to:

```typescript
const result = await pipeline.transpile({ kind: "files" });
```

**Step 2: Update ServeCommand.ts `_handleTranspile`**

At lines 289-292, change:

```typescript
const result = await ServeCommand.transpiler.transpileSource(source, options);
```

to:

```typescript
const transpileResult = await ServeCommand.transpiler.transpile({
  kind: "source",
  source,
  ...options,
});
const result =
  transpileResult.files.find(
    (f) => f.sourcePath === (filePath ?? "<string>"),
  ) ?? transpileResult.files[0];
```

Note: `result` must remain an `IFileResult` since lines 294-302 access `result.success`, `result.code`, `result.errors`.

**Step 3: Update ServeCommand.ts `_handleParseSymbols`**

At lines 320-323, change:

```typescript
await ServeCommand.transpiler.transpileSource(source, {
  workingDir: dirname(filePath),
  sourcePath: filePath,
});
```

to:

```typescript
await ServeCommand.transpiler.transpile({
  kind: "source",
  source,
  workingDir: dirname(filePath),
  sourcePath: filePath,
});
```

**Step 4: Run integration and CLI tests**

Run: `npm run test:q`
Expected: 958/958 pass

Run: `npm run unit -- src/cli`
Expected: ALL PASS

**Step 5: Commit**

```
refactor: migrate Runner and ServeCommand to transpile()
```

---

### Task 4: Migrate test files to `transpile()`

This is the largest task — ~90 call sites across 8 test files. Use ts-morph or find-and-replace patterns.

**Files:**

- Modify: `src/transpiler/__tests__/Transpiler.test.ts`
- Modify: `src/transpiler/__tests__/Transpiler.coverage.test.ts`
- Modify: `src/transpiler/__tests__/DualCodePaths.test.ts`
- Modify: `src/transpiler/__tests__/determineProjectRoot.test.ts`
- Modify: `src/transpiler/output/codegen/__tests__/RequireInclude.test.ts`
- Modify: `src/transpiler/output/codegen/__tests__/TrackVariableTypeHelpers.test.ts`
- Modify: `src/transpiler/output/codegen/__tests__/ExpressionWalker.test.ts`

**Step 1: Migrate `.run()` calls**

Pattern: `transpilerVar.run()` → `transpilerVar.transpile({ kind: "files" })`

This is a mechanical replacement. The return type is identical (`ITranspilerResult`), so no other changes needed at `.run()` call sites.

**Step 2: Migrate `.transpileSource(source, opts)` calls**

Pattern: `transpilerVar.transpileSource(source, opts)` → `(await transpilerVar.transpile({ kind: "source", source, ...opts })).files[0]`

Or for readability, introduce a helper in each test file:

```typescript
/** Helper: transpile source and extract single file result */
async function transpileSource(
  transpiler: Transpiler,
  source: string,
  opts?: { workingDir?: string; includeDirs?: string[]; sourcePath?: string },
): Promise<IFileResult> {
  const result = await transpiler.transpile({
    kind: "source",
    source,
    ...opts,
  });
  return (
    result.files[0] ?? {
      sourcePath: opts?.sourcePath ?? "<string>",
      code: "",
      success: false,
      errors: result.errors,
      declarationCount: 0,
    }
  );
}
```

This keeps test readability close to the original while using the new API.

**Step 3: Update DualCodePaths.test.ts**

This file specifically tests that both paths produce identical output. After unification, the tests should verify that `{ kind: 'files' }` and `{ kind: 'source' }` produce identical results through the same `transpile()` method. Update the test descriptions and assertions:

```typescript
// Before:
const result1 = await transpiler1.run();
const result2 = await transpiler2.transpileSource(source, { ... });
expect(result1.files[0].code).toBe(result2.code);

// After:
const result1 = await transpiler1.transpile({ kind: "files" });
const result2 = await transpiler2.transpile({ kind: "source", source, ... });
expect(result1.files[0].code).toBe(result2.files[0].code);
```

**Step 4: Run all unit tests**

Run: `npm run unit`
Expected: ALL 5337 pass

**Step 5: Run integration tests**

Run: `npm run test:q`
Expected: 958/958 pass

**Step 6: Commit**

```
refactor: migrate all test files to transpile() API
```

---

### Task 5: Delete `run()` and `transpileSource()`

Now that all callers use `transpile()`, remove the old methods.

**Files:**

- Modify: `src/transpiler/Transpiler.ts`

**Step 1: Inline `run()` logic into `transpile()`**

The `transpile()` method from Task 2 currently delegates to `run()` for the files case. Inline the `run()` body into the `kind === "files"` branch of `transpile()`:

```typescript
async transpile(input: TTranspileInput): Promise<ITranspilerResult> {
  const result = this._initResult();

  try {
    await this._initializeRun();

    if (input.kind === "files") {
      // File discovery from config.inputs
      const { cnextFiles, headerFiles } = await this.discoverSources();
      if (cnextFiles.length === 0) {
        return this._finalizeResult(result, "No C-Next source files found");
      }

      this._ensureOutputDirectories();

      const pipelineFiles: IPipelineFile[] = cnextFiles.map((f) => ({
        path: f.path,
        discoveredFile: f,
      }));

      const pipelineInput: IPipelineInput = {
        cnextFiles: pipelineFiles,
        headerFiles,
        writeOutputToDisk: true,
      };

      await this._executePipeline(pipelineInput, result);
    } else {
      // Source discovery from in-memory string
      const pipelineInput = this._discoverFromSource(
        input.source,
        input.workingDir ?? process.cwd(),
        input.includeDirs ?? [],
        input.sourcePath ?? "<string>",
      );

      await this._executePipeline(pipelineInput, result);
    }

    return await this._finalizeResult(result);
  } catch (err) {
    return this._handleRunError(result, err);
  }
}
```

**Step 2: Delete `run()` method** (lines 140-177)

**Step 3: Delete `transpileSource()` method** (lines 189-240)

Also delete the helper methods that were only used by `transpileSource()`:

- `buildErrorResult()` — check if still used elsewhere first
- `buildCatchResult()` — check if still used elsewhere first

Note: `buildCatchResult` and `buildErrorResult` may still be used by `_transpileFile()`. Only delete if truly orphaned.

**Step 4: Run all tests**

Run: `npm run unit && npm run test:q`
Expected: ALL PASS

**Step 5: Commit**

```
refactor: delete run() and transpileSource(), transpile() is the single entry point
```

---

### Task 6: Unify discovery into `discoverIncludes()`

Replace `discoverSources()` and `_discoverFromSource()` with a single `discoverIncludes()`.

**Files:**

- Modify: `src/transpiler/Transpiler.ts`

**Step 1: Create `discoverIncludes()` method**

```typescript
/**
 * Stage 1: Discover files and build pipeline input.
 *
 * Branches on input kind:
 * - 'files': filesystem scan, dependency graph, topological sort
 * - 'source': parse in-memory string, walk include tree
 *
 * Header directive storage happens via IncludeResolver.resolve() for both
 * C headers and cnext includes (Issue #854).
 */
private async discoverIncludes(input: TTranspileInput): Promise<IPipelineInput> {
  if (input.kind === "files") {
    return this._discoverFromFiles();
  }
  return this._discoverFromSource(
    input.source,
    input.workingDir ?? process.cwd(),
    input.includeDirs ?? [],
    input.sourcePath ?? "<string>",
  );
}
```

Then rename `discoverSources()` → `_discoverFromFiles()` (it returns `{cnextFiles, headerFiles}` which needs wrapping into `IPipelineInput`).

**Step 2: Update `transpile()` to use `discoverIncludes()`**

Replace the branching in `transpile()` with:

```typescript
async transpile(input: TTranspileInput): Promise<ITranspilerResult> {
  const result = this._initResult();

  try {
    await this._initializeRun();

    const pipelineInput = await this.discoverIncludes(input);
    if (pipelineInput.cnextFiles.length === 0) {
      return this._finalizeResult(result, "No C-Next source files found");
    }

    if (input.kind === "files") {
      this._ensureOutputDirectories();
    }

    await this._executePipeline(pipelineInput, result);
    return await this._finalizeResult(result);
  } catch (err) {
    return this._handleRunError(result, err);
  }
}
```

**Step 3: Move header directive propagation into `discoverIncludes()`**

The duplicate loops that store header directives in `_discoverFromSource()` (lines 544-558) and `_processCnextIncludes()` (lines 869-874) should converge. Since `IncludeResolver.resolve()` now stores directives for both C headers and cnext includes (Issue #854), the propagation loop in `discoverIncludes()` can be a single pass over `resolved.headerIncludeDirectives` regardless of path.

**Step 4: Delete old `discoverSources()` (now `_discoverFromFiles()` handles files path)**

**Step 5: Run all tests**

Run: `npm run unit && npm run test:q`
Expected: ALL PASS

**Step 6: Commit**

```
refactor: unify file discovery into discoverIncludes()
```

---

### Task 7: Merge header generation methods

Merge `generateHeader()` (Stage 6, run path) and `generateHeaderContent()` (Stage 5, transpileSource path) into one method.

**Files:**

- Modify: `src/transpiler/Transpiler.ts`

**Step 1: Analyze differences between the two methods**

Key differences (from the design doc investigation):

| Aspect              | `generateHeader()` (L1245)                                   | `generateHeaderContent()` (L1359) |
| ------------------- | ------------------------------------------------------------ | --------------------------------- |
| Symbol source       | `symbolTable.getTSymbolsByFile()`                            | Passed as parameter               |
| `typeInput`         | `state.getSymbolInfo(file.path)`                             | `CodeGenState.symbols`            |
| `knownEnums`        | `TransitiveEnumCollector.aggregateKnownEnums(allSymbolInfo)` | `symbolInfo.knownEnums`           |
| `passByValueParams` | `state.getPassByValueParams(file.path)`                      | Passed as parameter               |
| `userIncludes`      | `state.getUserIncludes(file.path)`                           | Passed as parameter               |
| Output              | Writes to disk, returns path                                 | Returns string                    |

The Stage 6 version reads everything from `state` (which was populated during Stage 5). The Stage 5 version receives it as parameters. After unification, always read from `state` — the data is populated there by `_transpileFile()` at lines 444-446.

**Step 2: Create `generateHeaderForFile()`**

```typescript
private generateHeaderForFile(file: IPipelineFile): string | null {
  const sourcePath = file.path;
  const tSymbols = CodeGenState.symbolTable.getTSymbolsByFile(sourcePath);
  const exportedSymbols = tSymbols.filter((s) => s.isExported);

  if (exportedSymbols.length === 0) {
    return null;
  }

  const headerName = basename(sourcePath).replace(/\.cnx$|\.cnext$/, ".h");
  const typeInput = this.state.getSymbolInfo(sourcePath);
  const passByValueParams =
    this.state.getPassByValueParams(sourcePath) ??
    new Map<string, Set<string>>();
  const userIncludes = this.state.getUserIncludes(sourcePath);

  const allKnownEnums = TransitiveEnumCollector.aggregateKnownEnums(
    this.state.getAllSymbolInfo(),
  );

  const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
    this.state.getAllHeaderDirectives(),
    CodeGenState.symbolTable,
  );

  const typeInputWithSymbolTable = typeInput
    ? { ...typeInput, symbolTable: CodeGenState.symbolTable }
    : undefined;

  const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
  const headerSymbols = this.convertToHeaderSymbols(
    exportedSymbols,
    unmodifiedParams,
    allKnownEnums,
  );

  return this.headerGenerator.generate(
    headerSymbols,
    headerName,
    {
      exportedOnly: true,
      userIncludes,
      externalTypeHeaders,
      cppMode: this.cppDetected,
    },
    typeInputWithSymbolTable,
    passByValueParams,
    allKnownEnums,
  );
}
```

**Step 3: Update `_transpileFile()` to use `generateHeaderForFile()`**

At line 458, change:

```typescript
const headerCode = this.generateHeaderContent(
  fileSymbols,
  sourcePath,
  this.cppDetected,
  userIncludes,
  passByValueCopy,
  symbolInfo,
);
```

to:

```typescript
const headerCode = this.generateHeaderForFile(file);
```

This works because `_transpileFile()` has already stored all needed data in `state` at lines 444-446.

**Step 4: Update `_generateAllHeadersFromPipeline()` to use `generateHeaderForFile()`**

At line 724, change:

```typescript
const headerPath = this.generateHeader(file.discoveredFile);
```

to:

```typescript
const headerContent = this.generateHeaderForFile(file);
if (headerContent) {
  const headerPath = this.pathResolver.getHeaderOutputPath(file.discoveredFile);
  this.fs.writeFile(headerPath, headerContent);
  result.outputFiles.push(headerPath);
}
```

And simplify `_generateAllHeadersFromPipeline()` accordingly.

**Step 5: Delete old methods**

Delete `generateHeader()` (lines 1245-1310) and `generateHeaderContent()` (lines 1359-1411).

**Step 6: Run all tests**

Run: `npm run unit && npm run test:q`
Expected: ALL PASS

**Step 7: Commit**

```
refactor: merge generateHeader()/generateHeaderContent() into generateHeaderForFile()
```

---

### Task 8: Clean up references and documentation

**Files:**

- Modify: `src/transpiler/Transpiler.ts` (file header comment)
- Modify: `src/transpiler/__tests__/DualCodePaths.test.ts` (update test descriptions)
- Modify: `src/transpiler/data/__tests__/IncludeResolver.test.ts` (update comments referencing `Pipeline.run()`)
- Modify: `src/transpiler/output/codegen/CodeGenerator.ts` (update comments referencing `Pipeline.transpileSource()`)
- Modify: `CLAUDE.md` (update Transpiler Entry Points section)

**Step 1: Update Transpiler.ts file header**

Change lines 1-11 to reflect single entry point:

```typescript
/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * Key insight from ADR-053: "A single file transpilation is just a project
 * with one .cnx file."
 *
 * Architecture: transpile() is the single entry point. It discovers files
 * via discoverIncludes(), then delegates to _executePipeline(). There is
 * ONE pipeline for all transpilation.
 */
```

**Step 2: Update DualCodePaths.test.ts descriptions**

Update the file header comment and test descriptions from "run() and transpileSource()" to "transpile({ kind: 'files' }) and transpile({ kind: 'source' })".

**Step 3: Grep for stale references**

Run: `grep -rn "\.run()\|transpileSource\|discoverSources\|_discoverFromSource\|generateHeaderContent" src/ --include="*.ts" | grep -v node_modules | grep -v "\.test\." | grep -v "__tests__"`

Fix any remaining references in comments or JSDoc.

**Step 4: Update CLAUDE.md Transpiler Entry Points**

Change the table:

```markdown
| Entry Point   | Purpose                                  |
| ------------- | ---------------------------------------- |
| `transpile()` | Single entry point for all transpilation |
```

And update the description:

```markdown
Accepts `{ kind: 'files' }` for CLI/multi-file or `{ kind: 'source', source }` for API/single-file.
Always returns `ITranspilerResult`. `DualCodePaths.test.ts` verifies parity between both modes.
```

Also update the header state propagation note:

```markdown
**Header directive propagation**: Handled by `IncludeResolver.resolve()` for all include types (C headers and cnext includes). No path-specific code.
```

**Step 5: Run full verification**

Run: `npm run test:all`
Expected: ALL PASS

**Step 6: Commit**

```
docs: update references for unified transpile() API
```

---

### Task 9: Final verification and cleanup

**Step 1: Run full test suite**

Run: `npm run test:all`
Expected: ALL PASS

**Step 2: Run coverage**

Run: `npm run unit:coverage`
Expected: >= 80% on new/modified files

**Step 3: Run dead code check**

Run: `npx knip`
Expected: No new unused exports

**Step 4: Run duplication check**

Run: `npm run analyze:duplication`
Expected: No new duplication

**Step 5: Verify no stale references**

Run: `grep -rn "\.run()\b" src/ --include="*.ts" | grep -v "Cli.run\|node_modules"`
Expected: Zero results (only `Cli.run()` should remain, which is the CLI entry point, not the transpiler)

Run: `grep -rn "transpileSource" src/ --include="*.ts"`
Expected: Zero results

**Step 6: Commit if any final adjustments were made**

```
chore: final cleanup for unified transpile() API
```
