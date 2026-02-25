# Single Entry Point Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace directory-based file discovery with single entry point file; all other files discovered via includes.

**Architecture:** CLI accepts exactly one `.cnx` file. Transpiler walks `#include` directives to discover all files (already works). `basePath` inferred from entry file's parent directory, overridable via config. Directory scanning code removed.

**Tech Stack:** TypeScript, Vitest, ANTLR4-based transpiler

---

### Task 1: Update ITranspilerConfig — `inputs` → `input`

**Files:**

- Modify: `src/transpiler/types/ITranspilerConfig.ts`

**Step 1: Update the interface field**

Change `inputs: string[]` to `input: string`:

```typescript
/** Entry point file to transpile */
input: string;
```

**Step 2: Run build to find all compilation errors**

Run: `npm run build 2>&1 | head -50`
Expected: Multiple type errors referencing `inputs` — this is expected, we fix them in subsequent tasks.

**Step 3: Commit**

```
feat: change ITranspilerConfig.inputs to single input entry point
```

---

### Task 2: Update ICliConfig — `inputs` → `input`

**Files:**

- Modify: `src/cli/types/ICliConfig.ts`

**Step 1: Update the interface field**

Change `inputs: string[]` to `input: string`:

```typescript
/** Entry point .cnx file to transpile */
input: string;
```

**Step 2: Commit**

```
feat: change ICliConfig.inputs to single input entry point
```

---

### Task 3: Update Cli.ts — validation and config merge

**Files:**

- Modify: `src/cli/Cli.ts`

**Step 1: Update mergeConfig to use single input**

In `mergeConfig()`, change:

```typescript
inputs: args.inputFiles,
```

to:

```typescript
input: args.inputFiles[0] ?? "",
```

**Step 2: Update validation**

Change the validation block (line ~69) from:

```typescript
if (config.inputs.length === 0) {
  console.error("Error: No input files specified");
```

to:

```typescript
if (!config.input) {
  console.error("Error: No input file specified");
  console.error("Usage: cnext <file.cnx>");
```

**Step 3: Add directory rejection**

After the empty-input check, add directory rejection:

```typescript
const resolvedInput = resolve(config.input);
if (existsSync(resolvedInput) && statSync(resolvedInput).isDirectory()) {
  console.error(
    `Error: Directory input not supported. Specify an entry point file.`,
  );
  console.error(`Example: cnext ${config.input}/main.cnx`);
  return { shouldRun: false, exitCode: 1 };
}
```

Add imports for `resolve`, `existsSync`, `statSync` from `node:path` and `node:fs`.

**Step 4: Add multi-file rejection**

Before the single-input validation, reject multiple files:

```typescript
if (args.inputFiles.length > 1) {
  console.error("Error: Only one entry point file is supported");
  console.error(
    "Other files are discovered automatically via #include directives",
  );
  return { shouldRun: false, exitCode: 1 };
}
```

**Step 5: Update clean command call**

Change:

```typescript
CleanCommand.execute(config.inputs, ...)
```

to:

```typescript
CleanCommand.execute(config.input, ...)
```

**Step 6: Commit**

```
feat: validate single entry point file in CLI
```

---

### Task 4: Update Runner.ts — simplify to single file

**Files:**

- Modify: `src/cli/Runner.ts`

**Step 1: Remove \_categorizeInputs and \_expandInputFiles**

Delete both methods entirely. Remove the `ICategorizedInputs` interface.

**Step 2: Simplify execute()**

Replace the body of `execute()` with:

```typescript
static async execute(config: ICliConfig): Promise<void> {
  const resolvedInput = resolve(config.input);
  const { outDir, explicitOutputFile } = this._determineOutputPath(
    config,
    [resolvedInput],
  );

  // Infer basePath from entry file's parent directory if not set
  const basePath = config.basePath || dirname(resolvedInput);

  const pipeline = new Transpiler({
    input: resolvedInput,
    includeDirs: config.includeDirs,
    outDir,
    headerOutDir: config.headerOutDir,
    basePath,
    preprocess: config.preprocess,
    defines: config.defines,
    cppRequired: config.cppRequired,
    noCache: config.noCache,
    parseOnly: config.parseOnly,
    target: config.target,
    debugMode: config.debugMode,
  });

  const result = await pipeline.transpile({ kind: "files" });
  this._renameOutputIfNeeded(result, explicitOutputFile);

  ResultPrinter.print(result);
  process.exit(result.success ? 0 : 1);
}
```

**Step 3: Remove InputExpansion import**

Delete: `import InputExpansion from "../transpiler/data/InputExpansion";`

**Step 4: Commit**

```
refactor: simplify Runner to single entry point file
```

---

### Task 5: Update Transpiler.ts — single input throughout

**Files:**

- Modify: `src/transpiler/Transpiler.ts`

**Step 1: Update constructor config copy**

Change:

```typescript
inputs: config.inputs,
```

to:

```typescript
input: config.input,
```

**Step 2: Update PathResolver initialization**

Change:

```typescript
inputs: this.config.inputs,
```

to:

```typescript
inputs: [dirname(resolve(this.config.input))],
```

Note: PathResolver still takes `inputs: string[]` internally — we pass it the entry file's parent directory as the single input directory. This preserves relative path calculation.

**Step 3: Simplify \_discoverFromFiles()**

Replace Step 1 (lines ~939-949) from:

```typescript
const cnextFiles: IDiscoveredFile[] = [];
const fileByPath = new Map<string, IDiscoveredFile>();

for (const input of this.config.inputs) {
  this._discoverCNextFromInput(input, cnextFiles, fileByPath);
}
```

to:

```typescript
const cnextFiles: IDiscoveredFile[] = [];
const fileByPath = new Map<string, IDiscoveredFile>();

const entryFile = FileDiscovery.discoverFile(
  resolve(this.config.input),
  this.fs,
);
if (!entryFile || entryFile.type !== EFileType.CNext) {
  return { cnextFiles: [], headerFiles: [], writeOutputToDisk: true };
}
cnextFiles.push(entryFile);
fileByPath.set(resolve(entryFile.path), entryFile);
```

**Step 4: Remove \_discoverCNextFromInput()**

Delete the entire method (lines ~757-790). It handled both file and directory inputs — no longer needed.

**Step 5: Update determineProjectRoot()**

Change:

```typescript
const firstInput = this.config.inputs[0];
if (!firstInput) {
  return undefined;
}
```

to:

```typescript
const firstInput = this.config.input;
if (!firstInput) {
  return undefined;
}
```

**Step 6: Update the declared config type**

The private `config` field declaration uses `Required<ITranspilerConfig>`. Ensure the property name matches the interface change.

**Step 7: Commit**

```
refactor: Transpiler uses single input entry point
```

---

### Task 6: Update ServeCommand.ts — empty input for source mode

**Files:**

- Modify: `src/cli/serve/ServeCommand.ts`

**Step 1: Change inputs to input**

Change:

```typescript
inputs: [],
```

to:

```typescript
input: "",
```

**Step 2: Commit**

```
fix: update ServeCommand for single input config
```

---

### Task 7: Update CleanCommand.ts — single input

**Files:**

- Modify: `src/cli/CleanCommand.ts`

**Step 1: Update execute() signature**

Change:

```typescript
static execute(inputs: string[], outDir: string, headerOutDir?: string): void
```

to:

```typescript
static execute(input: string, outDir: string, headerOutDir?: string): void
```

**Step 2: Update discoverCnxFiles to use entry point include walking**

The clean command currently scans directories to find all `.cnx` files. With single entry point, it needs to discover files the same way the transpiler does — from the entry file's includes.

Replace `discoverCnxFiles` with:

```typescript
private static discoverCnxFiles(input: string): string[] | null {
  try {
    InputExpansion.validateFileExtension(resolve(input));
    // For clean command, we just need the entry file — PathResolver handles the rest
    return [resolve(input)];
  } catch (error) {
    console.error(`Error: ${error}`);
    return null;
  }
}
```

Note: This is a simplification. The clean command will only clean files it can derive paths for from the entry point. For a full solution, we'd need to walk includes, but that's a separate concern. For now, `--clean` with `--header-out` works for the entry file. A future improvement can walk the include tree.

Actually, a better approach: keep `InputExpansion.expandInputs` working for the single file (it already handles files), and let clean command still derive all output paths. Change `discoverCnxFiles`:

```typescript
private static discoverCnxFiles(input: string): string[] | null {
  try {
    const cnxFiles = InputExpansion.expandInputs([input]);
    if (cnxFiles.length === 0) {
      console.log("No .cnx files found. Nothing to clean.");
      return null;
    }
    return cnxFiles;
  } catch (error) {
    console.error(`Error: ${error}`);
    return null;
  }
}
```

**Step 3: Update PathResolver instantiation**

Change:

```typescript
const pathResolver = new PathResolver({ inputs, outDir, headerOutDir });
```

to:

```typescript
const pathResolver = new PathResolver({
  inputs: [dirname(resolve(input))],
  outDir,
  headerOutDir,
});
```

**Step 4: Commit**

```
refactor: CleanCommand accepts single input file
```

---

### Task 8: Remove directory scanning dead code

**Files:**

- Modify: `src/transpiler/data/FileDiscovery.ts` — remove `discover()` method and related code
- Modify: `src/transpiler/data/InputExpansion.ts` — remove `findCNextFiles()` directory scanning
- Delete or update: `src/transpiler/data/__tests__/FileDiscovery.test.ts` — remove directory tests
- Delete or update: `src/transpiler/data/__tests__/InputExpansion.test.ts` — remove directory tests

**Step 1: Remove FileDiscovery.discover()**

Delete the `discover()` static method. Keep `discoverFile()`, `discoverFiles()`, `classifyFile()`, `filterByType()`, `getCNextFiles()`, `getHeaderFiles()`.

Remove `regexToGlob()` (only used by `discover()`).

Remove the `DEFAULT_IGNORE_GLOBS` constant.

Remove `import fg from "fast-glob"` and the `IDiscoveryOptions` import if no longer needed.

**Step 2: Remove InputExpansion.findCNextFiles()**

Delete the `findCNextFiles()` method. In `expandInputs()`, remove the directory branch — only keep the file validation path:

```typescript
static expandInputs(inputs: string[]): string[] {
  const files: string[] = [];

  for (const input of inputs) {
    const resolvedPath = resolve(input);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Input not found: ${input}`);
    }

    const stats = statSync(resolvedPath);

    if (stats.isFile()) {
      this.validateFileExtension(resolvedPath);
      files.push(resolvedPath);
    }
  }

  return Array.from(new Set(files));
}
```

**Step 3: Update tests**

Remove directory-scanning test cases from FileDiscovery and InputExpansion test files. Keep file validation tests.

**Step 4: Commit**

```
refactor: remove directory scanning code (FileDiscovery.discover, InputExpansion.findCNextFiles)
```

---

### Task 9: Remove fast-glob dependency

**Files:**

- Modify: `package.json`

**Step 1: Remove fast-glob**

Run: `npm uninstall fast-glob`

**Step 2: Verify no imports remain**

Search for `fast-glob` in source to confirm no remaining references.

**Step 3: Commit**

```
chore: remove fast-glob dependency (no longer needed)
```

---

### Task 10: Update all unit tests

**Files:**

- Modify: All test files that construct configs with `inputs: [...]`

The key test files needing `inputs` → `input` changes:

- `src/cli/__tests__/Cli.test.ts`
- `src/cli/__tests__/Runner.test.ts`
- `src/cli/__tests__/PathNormalizer.test.ts`
- `src/cli/__tests__/ConfigPrinter.test.ts`
- `src/cli/__tests__/CleanCommand.test.ts`
- `src/__tests__/index.test.ts`
- `src/transpiler/__tests__/Transpiler.test.ts`
- `src/transpiler/__tests__/Transpiler.coverage.test.ts`
- `src/transpiler/__tests__/DualCodePaths.test.ts`
- `src/transpiler/__tests__/determineProjectRoot.test.ts`
- `src/transpiler/__tests__/needsConditionalPreprocessing.test.ts`
- `src/transpiler/data/__tests__/PathResolver.test.ts`
- `src/transpiler/output/codegen/__tests__/RequireInclude.test.ts`
- `src/transpiler/output/codegen/__tests__/CodeGenerator.test.ts`
- `src/transpiler/output/codegen/__tests__/ExpressionWalker.test.ts`
- `src/transpiler/output/codegen/__tests__/TrackVariableTypeHelpers.test.ts`
- `src/transpiler/output/codegen/generators/support/__tests__/IncludeGenerator.test.ts`

**Strategy:** For each file, change `inputs: ["file.cnx"]` → `input: "file.cnx"` and `inputs: ["dir/"]` → `input: "dir/file.cnx"` (or remove directory-specific test cases). For `inputs: []` in ConfigPrinter tests, change to `input: ""`.

For test files constructing Transpiler configs with `inputs: [file]`, change to `input: file`.

**Step 1: Batch update — use find-and-replace across all test files**

For each file, change the config property. Most are mechanical `inputs: ["X"]` → `input: "X"` changes.

**Step 2: Run unit tests**

Run: `npm run unit`
Expected: All pass.

**Step 3: Commit**

```
test: update all unit tests for single input entry point
```

---

### Task 11: Update integration tests

**Files:**

- Modify: `tests/integration/issue-339-include-paths.test.ts`
- Modify: `tests/integration/issue-337-directory-structure.test.ts`
- Modify: `tests/integration/issue-349-angle-include-paths.test.ts`
- Modify: `tests/integration/scope-header-visibility.test.ts`
- Modify: `tests/integration/issue-280-lowbyte-header.test.ts`
- Modify: `tests/integration/issue-294-cross-scope-bare-error.test.ts`
- Modify: `tests/integration/multi-file-header-passByValue.test.ts`
- Modify: `tests/integration/header-out-and-clean.test.ts`

**Step 1: Update each integration test**

Same mechanical change: `inputs: [...]` → `input: "..."` (use the first/entry file).

Some tests that previously passed a directory will need to be updated to pass the entry-point file instead.

**Step 2: Run integration tests**

Run: `npm run test:q`
Expected: All 950 tests pass.

**Step 3: Commit**

```
test: update integration tests for single input entry point
```

---

### Task 12: Update PathNormalizer if needed

**Files:**

- Modify: `src/cli/PathNormalizer.ts` (if it references `inputs`)

**Step 1: Check and update**

PathNormalizer.normalizeConfig may reference `config.inputs`. Update to `config.input`.

**Step 2: Run unit tests**

Run: `npm run unit`

**Step 3: Commit**

```
refactor: update PathNormalizer for single input
```

---

### Task 13: Run full test suite and validate

**Step 1: Build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 2: Run all tests**

Run: `npm run test:all`
Expected: All tests pass.

**Step 3: Run analysis**

Run: `npm run analyze:all`
Expected: No new issues.

**Step 4: Commit any final fixes**

---

### Task 14: Update documentation

**Files:**

- Modify: `CLAUDE.md` — update Quick Reference table if command examples use directories
- Modify: `docs/learn-cnext-in-y-minutes.md` — if it mentions CLI usage

**Step 1: Update CLI usage examples**

Change any `cnext src/` examples to `cnext src/main.cnx`.

**Step 2: Commit**

```
docs: update CLI usage examples for single entry point
```
