# Unified Transpiler Pipeline Design

**Date:** 2026-02-21
**Status:** Accepted
**Context:** Issue #854 exposed that header directive propagation must be manually duplicated across `run()` and `transpileSource()` paths. This design eliminates that class of bug by unifying the entry points.

## Problem

The `Transpiler` class has two public entry points (`run()` and `transpileSource()`) that each have their own file discovery method (`discoverSources()` and `_discoverFromSource()`). Both produce `IPipelineInput` and delegate to the same `_executePipeline()`, but state propagation (header directives, include tracking) must be manually kept in sync across both paths. Issue #854 was caused by exactly this — cnext include header directives were only propagated in one path.

Additionally:

- Header generation has two methods: `generateHeader()` (run path, Stage 6) and `generateHeaderContent()` (transpileSource path, inline in Stage 5)
- `TransitiveEnumCollector` has separate `collect()` vs `collectForStandalone()` methods for each path
- The names `run()` and `transpileSource()` don't clearly communicate what distinguishes them

## Design

### 1. Single Public Entry Point

Replace `run()` and `transpileSource()` with one `transpile()` method:

```typescript
type TTranspileInput =
  | { kind: 'files' }
  | { kind: 'source'; source: string;
      workingDir?: string;
      includeDirs?: string[];
      sourcePath?: string; }

async transpile(input: TTranspileInput): Promise<ITranspilerResult>
```

- `{ kind: 'files' }` — CLI mode. Discovers files from `config.inputs`, writes output to disk.
- `{ kind: 'source', source }` — API/server mode. Parses in-memory source, returns results in `ITranspilerResult.files[0]`.

### 2. Unified Discovery

One private method replaces `discoverSources()` and `_discoverFromSource()`:

```typescript
private async discoverIncludes(input: TTranspileInput): Promise<IPipelineInput>
```

Branches on `input.kind`:

- `'files'` → filesystem scan, DependencyGraph, topological sort, `writeOutputToDisk: true`
- `'source'` → parse in-memory string, IncludeTreeWalker, `writeOutputToDisk: false`

Header directive storage for both C headers AND cnext includes happens inside `IncludeResolver.resolve()` (already done in #854 fix). The `discoverIncludes()` method reads directives from `resolved.headerIncludeDirectives` in one unified loop — no separate handling per path.

### 3. Unified Header Generation

Merge `generateHeader()` and `generateHeaderContent()` into:

```typescript
private generateHeaderForFile(file: IPipelineFile, ...): string | null
```

The `writeOutputToDisk` flag controls disk write vs return in `IFileResult.headerCode`. The header generation logic (symbol collection, enum aggregation, ExternalTypeHeaderBuilder) is identical.

### 4. Unified Return Type

`transpile()` always returns `ITranspilerResult`. For source mode, the caller extracts:

```typescript
const result = await transpiler.transpile({ kind: "source", source });
const file = result.files[0]; // IFileResult
```

No overloads, no discriminated return types. Simple and uniform.

### 5. Migration

Clean break — no deprecation wrappers. All callers updated in one PR:

| Caller                 | Before                                     | After                                                                                  |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `Runner.ts`            | `pipeline.run()`                           | `pipeline.transpile({ kind: 'files' })`                                                |
| `ServeCommand.ts`      | `transpiler.transpileSource(source, opts)` | `transpiler.transpile({ kind: 'source', source, ...opts })` then extract `.files[0]`   |
| Test files (~90 sites) | `.run()` / `.transpileSource(s, opts)`     | `.transpile({ kind: 'files' })` / `.transpile({ kind: 'source', source: s, ...opts })` |

### 6. Files Affected

| Change                                                                            | File                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delete `run()`, `transpileSource()`, `discoverSources()`, `_discoverFromSource()` | `Transpiler.ts`                                                                                                                                                                                        |
| Delete `generateHeader()`, `generateHeaderContent()`                              | `Transpiler.ts`                                                                                                                                                                                        |
| Add `transpile()`, `discoverIncludes()`, `generateHeaderForFile()`                | `Transpiler.ts`                                                                                                                                                                                        |
| Add `TTranspileInput` type                                                        | New: `src/transpiler/types/TTranspileInput.ts`                                                                                                                                                         |
| Update CLI caller                                                                 | `src/cli/Runner.ts`                                                                                                                                                                                    |
| Update server caller                                                              | `src/cli/serve/ServeCommand.ts`                                                                                                                                                                        |
| Update ~90 test call sites                                                        | `DualCodePaths.test.ts`, `Transpiler.test.ts`, `Transpiler.coverage.test.ts`, `determineProjectRoot.test.ts`, `RequireInclude.test.ts`, `TrackVariableTypeHelpers.test.ts`, `ExpressionWalker.test.ts` |
| Header directive propagation (already done)                                       | `IncludeResolver.ts`                                                                                                                                                                                   |

### 7. Success Criteria

- Single `transpile()` method — no `run()` or `transpileSource()`
- One `discoverIncludes()` method — no `discoverSources()` or `_discoverFromSource()`
- One `generateHeaderForFile()` — no `generateHeader()` or `generateHeaderContent()`
- All 958 integration tests pass
- All unit tests pass
- `DualCodePaths.test.ts` updated to test the unified entry point
- Header directive propagation has zero path-specific code
