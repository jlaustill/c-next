# Single Entry Point Design

**Date:** 2026-02-25
**Status:** Approved

## Problem

The CLI accepts directories (`cnext src/`) which triggers recursive filesystem scanning for all `.cnx` files. This is redundant because the transpiler already discovers all needed files by walking `#include` directives from the entry point. The directory mode also causes bugs: `PathResolver` can't compute correct `sourceRelativePath` for single-file inputs that were discovered via directory scanning, leading to flat self-includes (`#include "Foo.h"` instead of `#include "Data/Foo.h"`) that force users to add every subdirectory as a separate `-I` flag.

## Solution

Accept exactly one `.cnx` entry point file. All other files are discovered via include resolution (already works). Infer `basePath` from the entry file's parent directory, with config override.

## Changes

### CLI Layer

**Cli.ts:**

- Validate exactly one input file (not zero, not multiple, not a directory)
- Error message for directories: "Directory input not supported. Specify an entry point file: cnext src/main.cnx"

**Runner.ts:**

- Remove `_categorizeInputs()` — no directory/file split needed
- Remove `_expandInputFiles()` — no directory expansion needed
- Pass single file path directly to Transpiler
- Infer `basePath` from `dirname(entryFile)` when not set in config

**ICliConfig.ts:**

- `inputs: string[]` → `input: string`

### Transpiler Layer

**ITranspilerConfig.ts:**

- `inputs: string[]` → `input: string`

**Transpiler.ts:**

- `_discoverFromFiles()`: start with single entry file, walk includes (already works via `_processFileIncludes` array mutation loop)
- Remove directory branch from `_discoverCNextFromInput()` (or inline the single-file logic)
- `PathResolver` config: `inputs` derived from `dirname(config.input)`

### Dead Code Removal

- `InputExpansion.findCNextFiles()` and directory scanning in `expandInputs()`
- `FileDiscovery.discover()` (directory glob) — keep `discoverFile()` and `discoverFiles()`
- `Runner._categorizeInputs()`, `Runner._expandInputFiles()`
- Related unit tests for directory scanning
- `fast-glob` dependency (only used by `FileDiscovery.discover`)

### Already Done

- Self-include fix: `sourceRelativePath` wired up in `_transpileFile()` via `pathResolver.getSourceRelativePath()`

### Config Impact

- `cnext.config.json`: `basePath` becomes optional (inferred from entry file parent dir, overridable)
- OSSM `cnext_build.py`: change `cnext src` → `cnext src/main.cnx`
- OGauge `cnext_build.py`: already uses `cnext src/main.cnx` — no change

### What Stays the Same

- `_processFileIncludes` / `_processCnextIncludes` — already recursive
- `IncludeResolver` — unchanged
- `DependencyGraph` / topological sort — unchanged
- Source mode (`{ kind: 'source' }`) — unchanged
- `--clean` command — update to work from entry point
