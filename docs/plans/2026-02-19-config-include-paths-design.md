# Config Include Paths Enhancement Design

**Issue**: #829
**Date**: 2026-02-19
**Status**: Approved

## Problem

Two issues with `include` paths in `cnext.config.json`:

1. **Tilde not expanded**: `~/.platformio/packages/foo/include` is used literally instead of expanding `~` to home directory
2. **No recursive search**: Only the exact directory is searched, not subdirectories

## Solution

Create a `PathNormalizer` utility class that handles ALL path normalization for config values in a single place.

### Requirements (from brainstorming)

- Tilde expansion: `~` → `$HOME`
- Recursive search: opt-in via `**` suffix (e.g., `~/sdk/include/**`)
- Depth: unlimited
- Timing: eager expansion at config load time

## Architecture

```
cnext.config.json (raw paths)
        ↓
    ConfigLoader.load()  ← returns raw config
        ↓
    Cli.mergeConfig()
        ↓
    PathNormalizer.normalizeConfig(config)  ← single normalization point
        ↓
    ICliConfig (all paths normalized)
        ↓
    Runner / Transpiler
```

### Paths Normalized

| Config key  | Normalization                              |
| ----------- | ------------------------------------------ |
| `include`   | Tilde expansion + `**` recursive expansion |
| `output`    | Tilde expansion only                       |
| `headerOut` | Tilde expansion only                       |
| `basePath`  | Tilde expansion only                       |

Only `include` gets recursive expansion because `**` is a search path concept. Output directories should not recursively expand.

## API Design

**New file**: `src/cli/PathNormalizer.ts`

```typescript
class PathNormalizer {
  /**
   * Normalize all paths in a CLI config.
   * Single entry point for all path normalization.
   */
  static normalizeConfig(config: ICliConfig): ICliConfig;

  /**
   * Expand ~ to home directory.
   * Handles: ~, ~/path (only leading tilde)
   */
  static expandTilde(path: string): string;

  /**
   * Expand path/** to all subdirectories.
   * Returns array: one entry per directory found.
   */
  static expandRecursive(path: string, fs?: IFileSystem): string[];

  /**
   * Normalize a single path (tilde only, no recursive).
   * Used for output, headerOut, basePath.
   */
  static normalizePath(path: string): string;

  /**
   * Normalize include paths (tilde + recursive expansion).
   * Returns flattened array of all resolved directories.
   */
  static normalizeIncludePaths(paths: string[], fs?: IFileSystem): string[];
}
```

### Key Behaviors

- `expandTilde`: Uses `process.env.HOME || process.env.USERPROFILE` (matches existing Arduino path logic in IncludeDiscovery)
- `expandRecursive`: Only triggers if path ends with `/**`, walks all subdirs unlimited depth, returns empty array if path doesn't exist
- `fs` parameter: Allows mocking in tests (follows codebase pattern)

## Integration

**Modified file**: `src/cli/Cli.ts`

```typescript
private static mergeConfig(
  args: IParsedArgs,
  fileConfig: IFileConfig,
): ICliConfig {
  const rawConfig: ICliConfig = {
    inputs: args.inputFiles,
    outputPath: args.outputPath || fileConfig.output || "",
    includeDirs: [...(fileConfig.include ?? []), ...args.includeDirs],
    // ... rest unchanged
  };

  // Single normalization point for ALL paths
  return PathNormalizer.normalizeConfig(rawConfig);
}
```

**Why Cli.mergeConfig, not ConfigLoader**:

- CLI `--include` args also need normalization
- `mergeConfig` is where both sources combine — single point
- ConfigLoader stays focused on JSON parsing

## Testing Strategy

**New test file**: `src/cli/__tests__/PathNormalizer.test.ts`

### Unit Tests

| Test case                       | Input                      | Expected                            |
| ------------------------------- | -------------------------- | ----------------------------------- |
| `expandTilde` - basic           | `~/foo`                    | `/home/user/foo`                    |
| `expandTilde` - no tilde        | `/abs/path`                | `/abs/path`                         |
| `expandTilde` - tilde only      | `~`                        | `/home/user`                        |
| `expandTilde` - mid-path tilde  | `/foo/~/bar`               | `/foo/~/bar` (unchanged)            |
| `expandRecursive` - no suffix   | `/sdk/include`             | `["/sdk/include"]`                  |
| `expandRecursive` - with \*\*   | `/sdk/**`                  | `["/sdk", "/sdk/a", "/sdk/b", ...]` |
| `expandRecursive` - nonexistent | `/nonexistent/**`          | `[]`                                |
| `normalizeIncludePaths` - mixed | `["~/a", "/b/**"]`         | Combined expanded paths             |
| `normalizeConfig` - full        | Config with all path types | All paths normalized                |

### Mock Strategy

- Mock `process.env.HOME` via `vi.stubEnv()`
- Mock filesystem via `IFileSystem` interface (existing pattern)
- Create temp directories for recursive expansion tests

### Integration Test

In existing `Cli.test.ts`: Verify tilde paths in config file get expanded before reaching Runner.

## Files Changed

| File                                       | Change                                                     |
| ------------------------------------------ | ---------------------------------------------------------- |
| `src/cli/PathNormalizer.ts`                | New - all path normalization logic                         |
| `src/cli/__tests__/PathNormalizer.test.ts` | New - unit tests                                           |
| `src/cli/Cli.ts`                           | Call `PathNormalizer.normalizeConfig()` in `mergeConfig()` |
| `src/cli/__tests__/Cli.test.ts`            | Add integration test for path normalization                |
