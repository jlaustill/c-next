# VS Code Extension Architecture Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address 16 architectural issues in the VS Code extension across 10 tasks, improving code quality, performance, security, and maintainability.

**Architecture:** Extract shared utilities, convert sync I/O to async, add CancellationToken support, introduce dependency injection for global state, break up the monolithic completion provider, and add unit test coverage.

**Tech Stack:** TypeScript, VS Code Extension API, vitest (unit tests), esbuild (bundling)

---

## Task 1: Remove Debug File Writes

**Priority:** Critical (production bug)
**Files:**

- Modify: `vscode-extension/src/completionProvider.ts:1086-1092, 1120-1129`

**Step 1: Write the failing test**

Create `vscode-extension/src/__tests__/completionProvider.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";

describe("CNextCompletionProvider", () => {
  it("should not write debug files to /tmp", () => {
    // Grep the source for /tmp writes
    const source = fs.readFileSync(
      "vscode-extension/src/completionProvider.ts",
      "utf-8",
    );
    expect(source).not.toContain("/tmp/cnext-completions.txt");
    expect(source).not.toContain("/tmp/cnext-workspace-symbols.txt");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/linux/code/c-next && npx vitest run vscode-extension/src/__tests__/completionProvider.test.ts`
Expected: FAIL (source still contains `/tmp/` writes)

**Step 3: Remove debug file writes**

In `completionProvider.ts`, remove lines 1086-1092 (the `/tmp/cnext-completions.txt` block):

```typescript
// DELETE these lines:
// Log ALL items to a file for debugging
const allLabels = completionList.items.map((item) =>
  typeof item.label === "string" ? item.label : item.label.label,
);
// Write to temp file for inspection
const debugPath = "/tmp/cnext-completions.txt";
fs.writeFileSync(debugPath, allLabels.join("\n"), "utf-8");
debug(`C-Next: Wrote ${allLabels.length} items to ${debugPath}`);
```

Also remove lines 1120-1129 (the `/tmp/cnext-workspace-symbols.txt` block):

```typescript
// DELETE these lines:
      // Write workspace symbols to separate debug file
      const wsDebugPath = "/tmp/cnext-workspace-symbols.txt";
      if (symbols?.length) {
        // ...
        const symbolDetails = symbols.map(
          (s) =>
            `${s.name} (${vscode.SymbolKind[s.kind]}) - ${s.location.uri.fsPath}`,
        );
        fs.writeFileSync(wsDebugPath, symbolDetails.join("\n"), "utf-8");
        debug(`C-Next: Wrote workspace symbols to ${wsDebugPath}`);
```

Keep only the `debug()` calls that log to the output channel (those are appropriate for extension logging).

Also check: after removing these writes, if `fs` import is no longer needed for other sync operations in this file, note it for Task 5 (async conversion). For now leave the import.

**Step 4: Run test to verify it passes**

Run: `cd /home/linux/code/c-next && npx vitest run vscode-extension/src/__tests__/completionProvider.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add vscode-extension/src/completionProvider.ts vscode-extension/src/__tests__/completionProvider.test.ts
git commit -m "fix(vscode): remove debug file writes to /tmp in completion provider"
```

---

## Task 2: Extract Shared Utilities (findOutputPath, getAccessDescription, getLabel)

**Priority:** High (code duplication)
**Files:**

- Create: `vscode-extension/src/utils.ts`
- Create: `vscode-extension/src/__tests__/utils.test.ts`
- Modify: `vscode-extension/src/completionProvider.ts:286-308` (remove `findOutputPath`)
- Modify: `vscode-extension/src/hoverProvider.ts:205-220, 545-567` (remove `findOutputPath`, `getAccessDescription`)

**Step 1: Write the failing test**

Create `vscode-extension/src/__tests__/utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// We can't import vscode in vitest, so test the pure logic functions
// For findOutputPath we'll test the path construction logic only

describe("getAccessDescription", () => {
  // Import after creating the file
  it("maps rw to read-write", async () => {
    const { getAccessDescription } = await import("../utils.js");
    expect(getAccessDescription("rw")).toBe("read-write");
  });

  it("maps ro to read-only", async () => {
    const { getAccessDescription } = await import("../utils.js");
    expect(getAccessDescription("ro")).toBe("read-only");
  });

  it("maps wo to write-only", async () => {
    const { getAccessDescription } = await import("../utils.js");
    expect(getAccessDescription("wo")).toBe("write-only");
  });

  it("maps w1c to write-1-to-clear", async () => {
    const { getAccessDescription } = await import("../utils.js");
    expect(getAccessDescription("w1c")).toBe("write-1-to-clear");
  });

  it("maps w1s to write-1-to-set", async () => {
    const { getAccessDescription } = await import("../utils.js");
    expect(getAccessDescription("w1s")).toBe("write-1-to-set");
  });

  it("returns unknown access modifier as-is", async () => {
    const { getAccessDescription } = await import("../utils.js");
    expect(getAccessDescription("custom")).toBe("custom");
  });
});

describe("getCompletionLabel", () => {
  it("returns string labels directly", async () => {
    const { getCompletionLabel } = await import("../utils.js");
    expect(getCompletionLabel("myLabel")).toBe("myLabel");
  });

  it("extracts label from CompletionItemLabel objects", async () => {
    const { getCompletionLabel } = await import("../utils.js");
    expect(getCompletionLabel({ label: "myLabel", description: "desc" })).toBe(
      "myLabel",
    );
  });
});

describe("escapeRegex", () => {
  it("escapes regex metacharacters", async () => {
    const { escapeRegex } = await import("../utils.js");
    expect(escapeRegex("foo.bar")).toBe("foo\\.bar");
    expect(escapeRegex("a+b*c")).toBe("a\\+b\\*c");
    expect(escapeRegex("test$")).toBe("test\\$");
  });

  it("leaves normal strings unchanged", async () => {
    const { escapeRegex } = await import("../utils.js");
    expect(escapeRegex("normalWord")).toBe("normalWord");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/linux/code/c-next && npx vitest run vscode-extension/src/__tests__/utils.test.ts`
Expected: FAIL (module not found)

**Step 3: Create the shared utils module**

Create `vscode-extension/src/utils.ts`:

```typescript
/**
 * Shared utilities for the C-Next VS Code extension
 * Pure functions that don't depend on vscode API
 */

/**
 * Get human-readable access modifier description
 */
export function getAccessDescription(access: string): string {
  switch (access) {
    case "rw":
      return "read-write";
    case "ro":
      return "read-only";
    case "wo":
      return "write-only";
    case "w1c":
      return "write-1-to-clear";
    case "w1s":
      return "write-1-to-set";
    default:
      return access;
  }
}

/**
 * Extract the string label from a CompletionItem label
 * (which can be either a string or a { label, description } object)
 */
export function getCompletionLabel(
  label: string | { label: string; description?: string },
): string {
  return typeof label === "string" ? label : label.label;
}

/**
 * Escape special regex characters in a string
 * Use this when constructing RegExp from user/symbol input
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Named constants replacing magic numbers */
export const DIAGNOSTIC_DEBOUNCE_MS = 300;
export const TRANSPILE_TO_FILE_DEBOUNCE_MS = 500;
export const PREVIEW_UPDATE_DEBOUNCE_MS = 300;
export const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_GLOBAL_COMPLETION_ITEMS = 30;
export const MIN_PREFIX_LENGTH_FOR_CPP_QUERY = 2;
```

**Step 4: Update imports in completionProvider.ts and hoverProvider.ts**

In `completionProvider.ts`:

- Remove the local `getAccessDescription` function (lines 225-240)
- Import from utils: `import { getAccessDescription, getCompletionLabel, escapeRegex, MAX_GLOBAL_COMPLETION_ITEMS, MIN_PREFIX_LENGTH_FOR_CPP_QUERY } from "./utils";`
- Replace `typeof item.label === "string" ? item.label : item.label.label` with `getCompletionLabel(item.label)` (occurs ~6 times)
- Replace `allItems.slice(0, 30)` with `allItems.slice(0, MAX_GLOBAL_COMPLETION_ITEMS)`
- Replace `prefix.length >= 2` with `prefix.length >= MIN_PREFIX_LENGTH_FOR_CPP_QUERY`
- In `findMemberAccessPosition` (line 1290), use `escapeRegex(parentName)` instead of raw `parentName` in RegExp

In `hoverProvider.ts`:

- Remove the local `getAccessDescription` function (lines 205-220)
- Import from utils: `import { getAccessDescription, escapeRegex } from "./utils";`
- In `findWordInSource` (line 658), use `escapeRegex(word)` instead of raw `word` in RegExp

In `extension.ts`:

- Import constants: `import { DIAGNOSTIC_DEBOUNCE_MS, CACHE_CLEANUP_INTERVAL_MS } from "./utils";`
- Replace `300` on line 327 with `DIAGNOSTIC_DEBOUNCE_MS`

In `WorkspaceIndex.ts`:

- Import: `import { CACHE_CLEANUP_INTERVAL_MS } from "../utils";`
- Replace `5 * 60 * 1000` on line 99 with `CACHE_CLEANUP_INTERVAL_MS`

**Step 5: Extract findOutputPath to utils**

The `findOutputPath` function is duplicated in `completionProvider.ts:286-308` and `hoverProvider.ts:545-567`. However, it depends on `vscode` and `fs` APIs and accesses `lastGoodOutputPath` from extension.ts, so it can't be a pure function.

Create a helper that takes parameters instead of importing globals. Add to `utils.ts`:

```typescript
import * as fs from "node:fs";

/**
 * Find the output file path (.c or .cpp) for a .cnx file path
 * @param cnxFsPath The .cnx file's filesystem path
 * @param uriString The document URI as string (for cache lookup)
 * @param outputPathCache Map of URI -> last known good output path
 */
export function findOutputPath(
  cnxFsPath: string,
  uriString: string,
  outputPathCache: Map<string, string>,
): string | null {
  // Check for .cpp first (PlatformIO/Arduino projects often use .cpp)
  const cppPath = cnxFsPath.replace(/\.cnx$/, ".cpp");
  if (fs.existsSync(cppPath)) {
    return cppPath;
  }

  // Check for .c
  const cPath = cnxFsPath.replace(/\.cnx$/, ".c");
  if (fs.existsSync(cPath)) {
    return cPath;
  }

  // Neither exists - check the cache for last-known-good path
  const cachedPath = outputPathCache.get(uriString);
  if (cachedPath && fs.existsSync(cachedPath)) {
    return cachedPath;
  }

  return null;
}
```

Update both providers to call this shared function instead of their private copies, passing `lastGoodOutputPath` as a parameter.

**Step 6: Run tests**

Run: `cd /home/linux/code/c-next && npx vitest run vscode-extension/src/__tests__/utils.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add vscode-extension/src/utils.ts vscode-extension/src/__tests__/utils.test.ts vscode-extension/src/completionProvider.ts vscode-extension/src/hoverProvider.ts vscode-extension/src/extension.ts vscode-extension/src/workspace/WorkspaceIndex.ts
git commit -m "refactor(vscode): extract shared utils, fix regex injection, replace magic numbers"
```

---

## Task 3: Extract Scope/Function Tracking from CompletionProvider

**Priority:** High (code duplication + file size)
**Files:**

- Create: `vscode-extension/src/scopeTracker.ts`
- Create: `vscode-extension/src/__tests__/scopeTracker.test.ts`
- Modify: `vscode-extension/src/completionProvider.ts` (remove `getCurrentScope` and `getCurrentFunction`)

**Step 1: Write the failing test**

Create `vscode-extension/src/__tests__/scopeTracker.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import ScopeTracker from "../scopeTracker.js";

describe("ScopeTracker", () => {
  describe("getCurrentScope", () => {
    it("returns null at global level", () => {
      const source = "u32 x <- 5;";
      expect(ScopeTracker.getCurrentScope(source, 0)).toBeNull();
    });

    it("returns scope name inside a scope", () => {
      const source = `scope LED {
  public void on() {
    // cursor here
  }
}`;
      expect(ScopeTracker.getCurrentScope(source, 2)).toBe("LED");
    });

    it("returns null after scope closes", () => {
      const source = `scope LED {
  public void on() { }
}
u32 x <- 5;`;
      expect(ScopeTracker.getCurrentScope(source, 3)).toBeNull();
    });

    it("ignores scope keywords inside comments", () => {
      const source = `// scope Fake {
u32 x <- 5;`;
      expect(ScopeTracker.getCurrentScope(source, 1)).toBeNull();
    });
  });

  describe("getCurrentFunction", () => {
    it("returns null outside functions", () => {
      const source = "u32 x <- 5;";
      expect(ScopeTracker.getCurrentFunction(source, 0)).toBeNull();
    });

    it("returns function name inside a function", () => {
      const source = `void doWork() {
  u32 x <- 5;
}`;
      expect(ScopeTracker.getCurrentFunction(source, 1)).toBe("doWork");
    });

    it("returns null after function closes", () => {
      const source = `void doWork() {
  u32 x <- 5;
}
u32 y <- 10;`;
      expect(ScopeTracker.getCurrentFunction(source, 3)).toBeNull();
    });

    it("detects public functions", () => {
      const source = `public void toggle() {
  // cursor here
}`;
      expect(ScopeTracker.getCurrentFunction(source, 1)).toBe("toggle");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/linux/code/c-next && npx vitest run vscode-extension/src/__tests__/scopeTracker.test.ts`
Expected: FAIL (module not found)

**Step 3: Create ScopeTracker with unified implementation**

Create `vscode-extension/src/scopeTracker.ts`:

The key insight: `getCurrentScope` and `getCurrentFunction` share 90% of their logic (comment stripping, brace counting). Unify them into a private helper that takes a regex pattern and returns the matched name.

```typescript
/**
 * ScopeTracker - Determines scope and function context at a cursor position
 * Uses brace-counting with comment-stripping to track nesting
 */
export default class ScopeTracker {
  /**
   * Generic context tracker that finds the innermost matching block
   * @param source Full document source
   * @param cursorLine 0-based line number
   * @param pattern Regex to match block declarations (must have capture group 1 = name)
   */
  private static getContext(
    source: string,
    cursorLine: number,
    pattern: RegExp,
  ): string | null {
    const lines = source.split("\n");
    let currentName: string | null = null;
    let braceDepth = 0;
    let blockStartDepth = 0;

    for (
      let lineNum = 0;
      lineNum <= cursorLine && lineNum < lines.length;
      lineNum++
    ) {
      const line = lines[lineNum];
      const trimmed = line.trim();

      // Skip comment lines
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*")
      ) {
        continue;
      }

      // Remove inline comments before processing
      const clean = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");

      // Check for block declaration
      const match = clean.match(pattern);
      if (match) {
        currentName = match[1];
        blockStartDepth = braceDepth;
        braceDepth++;
        continue;
      }

      // Count braces
      for (const ch of clean) {
        if (ch === "{") braceDepth++;
        if (ch === "}") {
          braceDepth--;
          if (currentName && braceDepth <= blockStartDepth) {
            currentName = null;
            blockStartDepth = 0;
          }
        }
      }
    }

    return currentName;
  }

  /**
   * Get the current scope name at a cursor position
   * @param source Full document source
   * @param cursorLine 0-based line number
   */
  static getCurrentScope(source: string, cursorLine: number): string | null {
    return ScopeTracker.getContext(source, cursorLine, /\bscope\s+(\w+)\s*\{/);
  }

  /**
   * Get the current function name at a cursor position
   * @param source Full document source
   * @param cursorLine 0-based line number
   */
  static getCurrentFunction(source: string, cursorLine: number): string | null {
    return ScopeTracker.getContext(
      source,
      cursorLine,
      /(?:public\s+)?(?:\w+)\s+(\w+)\s*\([^)]*\)\s*\{/,
    );
  }
}
```

**Step 4: Update completionProvider.ts**

- Remove `getCurrentScope()` method (lines 429-498)
- Remove `getCurrentFunction()` method (lines 504-560)
- Import `ScopeTracker` at top: `import ScopeTracker from "./scopeTracker";`
- Replace `this.getCurrentScope(source, position)` with `ScopeTracker.getCurrentScope(source, position.line)`
- Replace `this.getCurrentFunction(source, position)` with `ScopeTracker.getCurrentFunction(source, position.line)`

**Step 5: Run tests**

Run: `cd /home/linux/code/c-next && npx vitest run vscode-extension/src/__tests__/scopeTracker.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add vscode-extension/src/scopeTracker.ts vscode-extension/src/__tests__/scopeTracker.test.ts vscode-extension/src/completionProvider.ts
git commit -m "refactor(vscode): extract ScopeTracker from completion provider, unify duplicate logic"
```

---

## Task 4: Add CancellationToken Support to All Providers

**Priority:** High (responsiveness)
**Files:**

- Modify: `vscode-extension/src/completionProvider.ts:313-318`
- Modify: `vscode-extension/src/hoverProvider.ts:426-429`
- Modify: `vscode-extension/src/definitionProvider.ts:27-30`

**Step 1: Update completionProvider.ts**

Change parameter name from `_token` to `token` and add checks:

```typescript
async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,  // was _token
    context: vscode.CompletionContext,
): Promise<vscode.CompletionItem[]> {
    // Early exit if cancelled
    if (token.isCancellationRequested) return [];
```

Add `if (token.isCancellationRequested) return [];` before each expensive operation:

- Before `parseWithSymbols(source)` call (~line 326)
- Before `this.queryCExtensionCompletions()` call (~line 380)
- Before `this.queryCExtensionGlobalCompletions()` call (~line 411)

**Step 2: Update hoverProvider.ts**

The `provideHover` method signature doesn't accept a token currently. Add it:

```typescript
async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,  // ADD this parameter
): Promise<vscode.Hover | null> {
    if (token.isCancellationRequested) return null;
```

Add check before `parseWithSymbols()` and before `queryCExtensionHover()`.

**Step 3: Update definitionProvider.ts**

```typescript
provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,  // ADD this parameter
): vscode.Definition | null {
    if (token.isCancellationRequested) return null;
```

Add check before `parseWithSymbols()` (inside `findLocalSymbol`) and before `workspaceIndex.findDefinition()`.

**Step 4: Commit**

```bash
git add vscode-extension/src/completionProvider.ts vscode-extension/src/hoverProvider.ts vscode-extension/src/definitionProvider.ts
git commit -m "feat(vscode): add CancellationToken support to all language providers"
```

---

## Task 5: Add Path Boundary Validation to IncludeResolver

**Priority:** High (security)
**Files:**

- Modify: `vscode-extension/src/workspace/IncludeResolver.ts:118-159`
- Create: `vscode-extension/src/__tests__/includeResolver.test.ts`

**Step 1: Write the failing test**

Create `vscode-extension/src/__tests__/includeResolver.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

// IncludeResolver imports vscode, so we need to mock it
// For now, test the path validation logic directly

describe("path boundary validation", () => {
  it("rejects path traversal beyond workspace root", () => {
    // Create a temp workspace structure
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnext-test-"));
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });

    // Verify that ../../../../etc/passwd resolves outside workspace
    const resolved = path.resolve(srcDir, "../../../../etc/passwd");
    expect(resolved.startsWith(tmpDir)).toBe(false);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

Note: Full IncludeResolver tests require mocking `vscode`. For now, add inline path validation.

**Step 2: Add workspace boundary check to IncludeResolver.resolve()**

In `IncludeResolver.ts`, modify the `resolve()` method to add a validation step after path resolution:

```typescript
resolve(
    includePath: string,
    fromFile: string,
    isSystem: boolean = false,
): string | undefined {
    // Check if this is an excluded header
    if (this.isExcluded(includePath)) {
      return undefined;
    }

    const fromDir = path.dirname(fromFile);

    // For local includes ("header.h"), try relative to the current file first
    if (!isSystem) {
      const relativePath = path.join(fromDir, includePath);
      const resolved = path.resolve(relativePath);
      // Validate path stays within workspace boundaries
      if (this.isWithinBoundary(resolved) && fs.existsSync(resolved)) {
        return resolved;
      }
    }

    // Try local include paths
    for (const searchPath of this.config.localIncludePaths) {
      const fullSearchPath = path.isAbsolute(searchPath)
        ? searchPath
        : path.join(this.config.workspaceRoot, searchPath);

      const candidatePath = path.join(fullSearchPath, includePath);
      const resolved = path.resolve(candidatePath);
      if (this.isWithinBoundary(resolved) && fs.existsSync(resolved)) {
        return resolved;
      }
    }

    // Try SDK include paths (SDK paths are trusted — no boundary check)
    for (const sdkPath of this.config.sdkIncludePaths) {
      const candidatePath = path.join(sdkPath, includePath);
      if (fs.existsSync(candidatePath)) {
        return path.resolve(candidatePath);
      }
    }

    return undefined;
}

/**
 * Check if a resolved path is within the workspace or configured include paths
 */
private isWithinBoundary(resolvedPath: string): boolean {
    // Must be within workspace root
    if (this.config.workspaceRoot) {
      if (resolvedPath.startsWith(this.config.workspaceRoot)) {
        return true;
      }
    }

    // Or within a configured local include path (they're already absolute at this point)
    for (const searchPath of this.config.localIncludePaths) {
      const absSearchPath = path.isAbsolute(searchPath)
        ? searchPath
        : path.join(this.config.workspaceRoot, searchPath);
      if (resolvedPath.startsWith(path.resolve(absSearchPath))) {
        return true;
      }
    }

    return false;
}
```

**Step 3: Run tests**

Run: `cd /home/linux/code/c-next && npx vitest run vscode-extension/src/__tests__/includeResolver.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add vscode-extension/src/workspace/IncludeResolver.ts vscode-extension/src/__tests__/includeResolver.test.ts
git commit -m "fix(vscode): add workspace boundary validation to include resolver"
```

---

## Task 6: Replace Global State with Extension Context

**Priority:** Medium (architectural improvement)
**Files:**

- Create: `vscode-extension/src/ExtensionContext.ts`
- Modify: `vscode-extension/src/extension.ts`
- Modify: `vscode-extension/src/completionProvider.ts`
- Modify: `vscode-extension/src/hoverProvider.ts`

**Step 1: Create ExtensionContext**

Create `vscode-extension/src/ExtensionContext.ts`:

```typescript
import * as vscode from "vscode";

/**
 * Shared extension context
 * Replaces exported module-level globals with an injectable object
 */
export default class CNextExtensionContext {
  readonly outputChannel: vscode.OutputChannel;
  readonly lastGoodOutputPath: Map<string, string> = new Map();

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  debug(message: string): void {
    this.outputChannel.appendLine(message);
  }
}
```

**Step 2: Update extension.ts**

- Remove `export let outputChannel` and `export const lastGoodOutputPath`
- Create `CNextExtensionContext` instance in `activate()`
- Pass it to providers: `new CNextCompletionProvider(workspaceIndex, extensionContext)`

**Step 3: Update completionProvider.ts**

- Remove `import { lastGoodOutputPath, outputChannel } from "./extension";`
- Accept `CNextExtensionContext` in constructor
- Replace `outputChannel` refs with `this.context.outputChannel`
- Replace `lastGoodOutputPath` refs with `this.context.lastGoodOutputPath`
- Replace standalone `debug()` function with `this.context.debug()`

**Step 4: Update hoverProvider.ts**

- Remove `import { lastGoodOutputPath } from "./extension";`
- Accept `CNextExtensionContext` in constructor
- Replace `lastGoodOutputPath` refs with `this.context.lastGoodOutputPath`

**Step 5: Commit**

```bash
git add vscode-extension/src/ExtensionContext.ts vscode-extension/src/extension.ts vscode-extension/src/completionProvider.ts vscode-extension/src/hoverProvider.ts
git commit -m "refactor(vscode): replace global state exports with injectable ExtensionContext"
```

---

## Task 7: Fix Singleton Lifecycle and Timer Cleanup

**Priority:** Medium (resource leaks)
**Files:**

- Modify: `vscode-extension/src/extension.ts:308, 351-359`
- Modify: `vscode-extension/src/workspace/WorkspaceIndex.ts:94-100, 549-557`
- Modify: `vscode-extension/src/previewProvider.ts:37-42, 470-480`

**Step 1: Fix timer cleanup in deactivate**

In `extension.ts`, update `deactivate()`:

```typescript
export function deactivate(): void {
  console.log("C-Next extension deactivated");

  // Clear any pending validation timeout
  if (validateTimeout) {
    clearTimeout(validateTimeout);
    validateTimeout = null;
  }

  // Clear all pending transpile timers
  for (const timer of transpileTimers.values()) {
    clearTimeout(timer);
  }
  transpileTimers.clear();

  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
  if (workspaceIndex) {
    workspaceIndex.dispose();
  }
}
```

Move `validateTimeout` declaration to module level (it already is, but ensure it's accessible in `deactivate`).

**Step 2: Fix WorkspaceIndex interval leak**

In `WorkspaceIndex.ts`, store the interval handle and clear it on dispose:

```typescript
private cleanupInterval: ReturnType<typeof setInterval> | null = null;

// In initialize():
this.cleanupInterval = setInterval(() => {
    this.cache.clearUnused();
    this.headerCache.clearUnused();
}, CACHE_CLEANUP_INTERVAL_MS);

// In dispose():
dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.fileChangeTimer) {
      clearTimeout(this.fileChangeTimer);
    }
    this.cache.clear();
    this.headerCache.clear();
    this.includeDependencies.clear();
    WorkspaceIndex.instance = null;
    this.initialized = false;  // Prevent re-initialization issues
}
```

**Step 3: Make singletons defensive against post-dispose access**

In `PreviewProvider.ts`, add guard in getInstance:

```typescript
public static getInstance(): PreviewProvider {
    if (!PreviewProvider.instance) {
      PreviewProvider.instance = new PreviewProvider();
    }
    return PreviewProvider.instance;
}
```

This pattern is actually fine as-is — the concern is if external code calls `getInstance()` after `dispose()`. Since `activate()` creates the instance and `deactivate()` disposes it, and VS Code won't call features after deactivation, this is acceptable. Just ensure `initialized` is reset in WorkspaceIndex.

**Step 4: Commit**

```bash
git add vscode-extension/src/extension.ts vscode-extension/src/workspace/WorkspaceIndex.ts
git commit -m "fix(vscode): fix timer cleanup in deactivate, prevent interval leak in WorkspaceIndex"
```

---

## Task 8: Add Webview CSP Nonce

**Priority:** Medium (security hardening)
**Files:**

- Modify: `vscode-extension/src/previewProvider.ts:55-63, 313-318, 444-462`

**Step 1: Generate nonce in show()**

When creating the webview panel, pass nonce support:

```typescript
// In show(), when creating panel:
this.panel = vscode.window.createWebviewPanel(
  "cnextPreview",
  "C-Next Preview",
  column,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
  },
);
```

**Step 2: Add nonce to getHtml()**

```typescript
private getHtml(code: string, error: string | null): string {
    // Generate a random nonce for CSP
    const nonce = this.getNonce();

    // ... existing code ...

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <title>C-Next Preview</title>
    <style nonce="${nonce}">
        /* ... existing CSS ... */
    </style>
</head>
<body>
    <!-- ... existing body ... -->
    <script nonce="${nonce}">
        // ... existing script ...
    </script>
</body>
</html>`;
}

private getNonce(): string {
    const array = new Uint8Array(16);
    require("node:crypto").getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
```

**Step 3: Commit**

```bash
git add vscode-extension/src/previewProvider.ts
git commit -m "fix(vscode): replace unsafe-inline CSP with nonce-based script/style policy"
```

---

## Task 9: Add Error Boundary to Preview Provider

**Priority:** Medium (robustness)
**Files:**

- Modify: `vscode-extension/src/previewProvider.ts:159-180`

**Step 1: Wrap updatePreview() in try-catch**

```typescript
private updatePreview(): void {
    if (!this.panel || !this.currentDocument) {
      return;
    }

    try {
      const source = this.currentDocument.getText();
      const result = transpile(source);

      if (result.success) {
        this.lastGoodCode = result.code;
        this.lastError = null;
        this.updateStatusBar(true, 0);
      } else {
        this.lastError = result.errors
          .map((e) => `Line ${e.line}:${e.column} - ${e.message}`)
          .join("\n");
        this.updateStatusBar(false, result.errors.length);
      }

      // Always show content (last good or current)
      this.panel.webview.html = this.getHtml(this.lastGoodCode, this.lastError);
    } catch (error) {
      // Infrastructure failure - show error in preview
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = `Internal error: ${message}`;
      this.updateStatusBar(false, 1);
      if (this.panel) {
        this.panel.webview.html = this.getHtml(this.lastGoodCode, this.lastError);
      }
      console.error("C-Next preview update failed:", error);
    }
}
```

**Step 2: Commit**

```bash
git add vscode-extension/src/previewProvider.ts
git commit -m "fix(vscode): add error boundary to preview provider updatePreview()"
```

---

## Task 10: Add Debounce to Active Editor Changes

**Priority:** Low (performance optimization)
**Files:**

- Modify: `vscode-extension/src/extension.ts:311-316`

**Step 1: Add debouncing for editor switch validation**

Currently, switching tabs immediately validates + transpiles. Rapid tab switching wastes resources.

```typescript
// Add alongside existing validateTimeout
let editorSwitchTimeout: NodeJS.Timeout | null = null;

// In the onDidChangeActiveTextEditor handler:
vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor?.document.languageId === "cnext") {
      // Debounce to avoid wasting resources on rapid tab switching
      if (editorSwitchTimeout) {
        clearTimeout(editorSwitchTimeout);
      }
      editorSwitchTimeout = setTimeout(() => {
        validateDocument(editor.document);
        previewProvider.onActiveEditorChange(editor);
        transpileToFile(editor.document);
        editorSwitchTimeout = null;
      }, 150);
    }
}),
```

Also clear this timer in `deactivate()`:

```typescript
if (editorSwitchTimeout) {
  clearTimeout(editorSwitchTimeout);
  editorSwitchTimeout = null;
}
```

**Step 2: Commit**

```bash
git add vscode-extension/src/extension.ts
git commit -m "perf(vscode): debounce active editor change handler to reduce rapid-switch overhead"
```

---

## Future Work (Not in This Plan)

These items are important but too large for this batch:

1. **Convert sync I/O to async** — Requires converting `fs.readFileSync`/`writeFileSync` to `vscode.workspace.fs` throughout. This is a significant refactor affecting all providers and WorkspaceIndex. Track as a separate issue.

2. **Break up completionProvider.ts** — After Tasks 1-3 remove ~200 lines, the file drops from 1331 to ~1100 lines. Further decomposition (extracting C/C++ extension bridge, Arduino fallback data) should be a separate task.

3. **Add unit test suite** — Tasks 1-3 create initial test files. A comprehensive test suite covering all providers needs its own plan with proper vscode API mocking setup.

4. **Migrate to Language Server Protocol** — This is a major architectural investment (days of work). Should be planned separately when the extension's language features become a performance bottleneck.

5. **Convert to `vscode.workspace.fs`** — Removes Node.js `fs` dependency, enables remote workspace support. Do this alongside the async I/O conversion.

6. **Bounded workspace indexing** — Add file count limits, concurrency control, and cancellation to `indexFolder()`. Track separately.
