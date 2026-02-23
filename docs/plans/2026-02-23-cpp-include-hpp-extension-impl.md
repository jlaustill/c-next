# Fix .hpp Include Directives in C++ Mode — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Issue #941 — generated `.cpp` files should use `.hpp` in `#include` directives for transpiler-generated headers in C++ mode.

**Architecture:** Pass `cppMode` through the existing `IIncludeTransformOptions` interface so `IncludeGenerator` can emit `.hpp` instead of `.h` when in C++ mode. This matches the pattern already used in `CodeGenerator.ts:2212` for self-includes.

**Tech Stack:** TypeScript, Vitest, C-Next transpiler

---

### Task 1: Write Failing Unit Tests for IncludeGenerator

**Files:**

- Modify: `src/transpiler/output/codegen/generators/support/__tests__/IncludeGenerator.test.ts`

**Step 1: Add cppMode unit tests**

Add these tests to the existing describe blocks in `IncludeGenerator.test.ts`:

In `"transformIncludeDirective - angle brackets"` block (after line 158):

```typescript
it("transforms angle bracket .cnx include to .hpp in C++ mode", () => {
  const result = transformIncludeDirective("#include <utils.cnx>", {
    sourcePath: null,
    cppMode: true,
  });
  expect(result).toBe("#include <utils.hpp>");
});

it("resolves path from inputs with .hpp in C++ mode", () => {
  vi.mocked(CnxFileResolver.findCnxFile).mockReturnValue(
    "/project/src/Display/utils.cnx",
  );
  vi.mocked(CnxFileResolver.getRelativePathFromInputs).mockReturnValue(
    "Display/utils.cnx",
  );

  const result = transformIncludeDirective("#include <utils.cnx>", {
    sourcePath: "/project/src/main.cnx",
    includeDirs: ["/project/src/Display"],
    inputs: ["/project/src"],
    cppMode: true,
  });

  expect(result).toBe("#include <Display/utils.hpp>");
});

it("falls back to .hpp in C++ mode when file not found", () => {
  vi.mocked(CnxFileResolver.findCnxFile).mockReturnValue(null);

  const result = transformIncludeDirective("#include <missing.cnx>", {
    sourcePath: "/project/src/main.cnx",
    inputs: ["/project/src"],
    cppMode: true,
  });

  expect(result).toBe("#include <missing.hpp>");
});
```

In `"transformIncludeDirective - quotes"` block (after line 223):

```typescript
it("transforms quoted .cnx include to .hpp in C++ mode", () => {
  vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

  const result = transformIncludeDirective('#include "helper.cnx"', {
    sourcePath: "/project/src/main.cnx",
    cppMode: true,
  });

  expect(result).toBe('#include "helper.hpp"');
});

it("transforms quoted include with relative path to .hpp in C++ mode", () => {
  vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

  const result = transformIncludeDirective('#include "../lib/utils.cnx"', {
    sourcePath: "/project/src/main.cnx",
    cppMode: true,
  });

  expect(result).toBe('#include "../lib/utils.hpp"');
});
```

In `"transformIncludeDirective - passthrough"` block (after line 264):

```typescript
it("passes through .h includes unchanged even in C++ mode", () => {
  const result = transformIncludeDirective('#include "myheader.h"', {
    sourcePath: "/project/main.cnx",
    cppMode: true,
  });
  expect(result).toBe('#include "myheader.h"');
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/transpiler/output/codegen/generators/support/__tests__/IncludeGenerator.test.ts`
Expected: FAIL — `cppMode` not recognized / `.h` emitted instead of `.hpp`

**Step 3: Commit failing tests**

```bash
git add src/transpiler/output/codegen/generators/support/__tests__/IncludeGenerator.test.ts
git commit -m "test: add failing tests for .hpp include directives in C++ mode (Issue #941)"
```

---

### Task 2: Implement IncludeGenerator Fix

**Files:**

- Modify: `src/transpiler/output/codegen/generators/support/IncludeGenerator.ts:12-102`

**Step 1: Add `cppMode` to interface**

At line 12 in `IIncludeTransformOptions`, add the field:

```typescript
interface IIncludeTransformOptions {
  sourcePath: string | null;
  includeDirs?: string[];
  inputs?: string[];
  cppMode?: boolean;
}
```

**Step 2: Update `resolveAngleIncludePath` (line 22)**

Add `cppMode` parameter and use dynamic extension:

```typescript
const resolveAngleIncludePath = (
  filename: string,
  sourcePath: string,
  includeDirs: string[],
  inputs: string[],
  cppMode: boolean,
): string | null => {
```

At line 45, change:

```typescript
// Before:
return relativePath ? relativePath.replace(/\.cnx$/, ".h") : null;
// After:
const ext = cppMode ? ".hpp" : ".h";
return relativePath ? relativePath.replace(/\.cnx$/, ext) : null;
```

**Step 3: Update `transformAngleInclude` (line 52)**

Pass `cppMode` to `resolveAngleIncludePath` and use dynamic fallback:

```typescript
const transformAngleInclude = (
  includeText: string,
  filename: string,
  options: IIncludeTransformOptions,
): string => {
  const {
    sourcePath,
    includeDirs = [],
    inputs = [],
    cppMode = false,
  } = options;

  // Try to resolve the correct output path
  if (sourcePath) {
    const resolvedPath = resolveAngleIncludePath(
      filename,
      sourcePath,
      includeDirs,
      inputs,
      cppMode,
    );
    if (resolvedPath) {
      return includeText.replace(`<${filename}.cnx>`, `<${resolvedPath}>`);
    }
  }

  // Fallback: simple replacement
  const ext = cppMode ? ".hpp" : ".h";
  return includeText.replace(`<${filename}.cnx>`, `<${filename}${ext}>`);
};
```

**Step 4: Update `transformQuoteInclude` (line 80)**

Use dynamic extension:

```typescript
const transformQuoteInclude = (
  includeText: string,
  filepath: string,
  options: IIncludeTransformOptions,
): string => {
  const { sourcePath, cppMode = false } = options;

  // Validate .cnx file exists if we have source path
  if (sourcePath) {
    const sourceDir = path.dirname(sourcePath);
    const cnxPath = path.resolve(sourceDir, `${filepath}.cnx`);

    if (!CnxFileResolver.cnxFileExists(cnxPath)) {
      throw new Error(
        `Error: Included C-Next file not found: ${filepath}.cnx\n` +
          `  Searched at: ${cnxPath}\n` +
          `  Referenced in: ${sourcePath}`,
      );
    }
  }

  // Transform to .h or .hpp based on mode
  const ext = cppMode ? ".hpp" : ".h";
  return includeText.replace(`"${filepath}.cnx"`, `"${filepath}${ext}"`);
};
```

**Step 5: Update JSDoc on `transformIncludeDirective` (line 105)**

Change comment from "converting .cnx to .h" to "converting .cnx to .h/.hpp":

```typescript
/**
 * ADR-010: Transform #include directives, converting .cnx to .h or .hpp
 * Issue #941: Uses .hpp extension when cppMode is true
 * ...
 */
```

**Step 6: Run unit tests to verify they pass**

Run: `npx vitest run src/transpiler/output/codegen/generators/support/__tests__/IncludeGenerator.test.ts`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/transpiler/output/codegen/generators/support/IncludeGenerator.ts
git commit -m "fix: use .hpp extension in IncludeGenerator when cppMode is true (Issue #941)"
```

---

### Task 3: Pass cppMode from CodeGenerator

**Files:**

- Modify: `src/transpiler/output/codegen/CodeGenerator.ts:2429-2435`

**Step 1: Add `cppMode` to options in `transformIncludeDirective`**

At line 2429, update the private method:

```typescript
  private transformIncludeDirective(includeText: string): string {
    return includeTransformIncludeDirective(includeText, {
      sourcePath: CodeGenState.sourcePath,
      includeDirs: CodeGenState.includeDirs,
      inputs: CodeGenState.inputs,
      cppMode: CodeGenState.cppMode,
    });
  }
```

**Step 2: Run full unit test suite**

Run: `npm run unit`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/transpiler/output/codegen/CodeGenerator.ts
git commit -m "fix: pass cppMode to IncludeGenerator for .hpp resolution (Issue #941)"
```

---

### Task 4: Regenerate Snapshots and Run Integration Tests

**Files:**

- Modify: ~79 `.expected.cpp` snapshot files (auto-generated)

**Step 1: Regenerate all test snapshots**

Run: `npm test -- --update`
Expected: Tests pass, `.expected.cpp` files updated with `.hpp` includes

**Step 2: Verify specific snapshot changed correctly**

Check `tests/include/include-cnx-basic.expected.cpp` — line 9 should now read:

```cpp
#include <helper-types.hpp>
```

Instead of the old:

```cpp
#include <helper-types.h>
```

**Step 3: Verify .expected.c files are UNCHANGED**

Run: `git diff tests/ -- '*.expected.c'`
Expected: No changes (C mode still uses `.h`)

**Step 4: Run full test suite**

Run: `npm run test:all`
Expected: ALL PASS

**Step 5: Commit updated snapshots**

```bash
git add tests/
git commit -m "test: regenerate .expected.cpp snapshots with .hpp includes (Issue #941)"
```

---

### Task 5: Validate MISRA Compliance

**Step 1: Run C static analysis**

Run: `npm run validate:c`
Expected: No new MISRA violations introduced

**Step 2: Run all analysis checks**

Run: `npm run analyze:all`
Expected: No new issues
