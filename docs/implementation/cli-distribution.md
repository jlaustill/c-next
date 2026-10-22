# CLI Executable Distribution

> **Formerly ADR-048.** Moved out of `docs/decisions/` on 2026-08-31 under the rewrite
> test (#1403): npm packaging, the `npx` entry point and the published binary's name are
> how this implementation ships, not anything cnx promises. A transpiler rebuilt in
> another stack would distribute differently and owe this document nothing. Number 048
> is retired — see [`../decisions/README.md`](../decisions/README.md).

**Status:** Implemented
**Date:** 2026-01-01
**Date Implemented:** 2026-01-03
**Decision Makers:** cnx Language Design Team

## Context

Currently, running the cnx transpiler requires:

```bash
node dist/index.js tests/basics/hello-world.cnx -o hello-world.c
```

This is cumbersome. We want:

```bash
cnx tests/basics/hello-world.cnx
```

With the `.c` file automatically output alongside the `.cnx` file (same directory, same base name).

### Goals

1. **Simple invocation** - `cnx file.cnx` instead of `node dist/index.js file.cnx`
2. **Smart defaults** - Output `.c` file next to `.cnx` file by default
3. **Optional override** - `-o` flag when you want different output location
4. **Global installation** - `npm install -g` or similar for system-wide access

---

## Research: Distribution Options

### Option A: npm bin (Node.js)

Add a `bin` field to `package.json`:

```json
{
  "bin": {
    "cnx": "./dist/index.js"
  }
}
```

Add shebang to `dist/index.js`:

```javascript
#!/usr/bin/env node
```

**Installation:**

```bash
npm install -g @smeltworks/cnx
# or locally
npm link
```

**Pros:**

- Simple, standard Node.js approach
- Works cross-platform
- Easy to publish to npm

**Cons:**

- Requires Node.js installed
- Slower startup than native binary

### Option B: Single Executable (Node SEA)

Node.js 20+ supports Single Executable Applications:

```bash
node --experimental-sea-config sea-config.json
```

Produces a standalone binary with Node.js bundled.

**Pros:**

- No Node.js dependency for end users
- Single file distribution
- Native Node.js feature (no third-party tools)

**Cons:**

- Large binary size (~50MB+)
- Still experimental (as of 2025)
- Complex build process
- **CommonJS only** — ESM must be bundled first (e.g., with esbuild)

**Note:** cnx uses `"type": "module"` (ESM). For SEA, would need:

```bash
npx esbuild dist/index.js --bundle --platform=node --outfile=bundle.cjs
# Then use bundle.cjs in sea-config.json
```

### Option C: Bun Compile

If using Bun instead of Node:

```bash
bun build ./dist/index.js --compile --outfile cnx
```

**Pros:**

- Fast startup
- Smaller binary than Node SEA
- Cross-compilation support

**Cons:**

- Requires switching to Bun
- Less mature ecosystem

### Option D: pkg (Legacy)

The `pkg` npm package (now deprecated):

```bash
npx pkg dist/index.js -o cnx
```

**Pros:**

- Produces standalone binary

**Cons:**

- Deprecated, no longer maintained
- Known issues with ESM modules

### Option E: nexe

Still-maintained alternative to pkg (13.5k GitHub stars):

```bash
npx nexe dist/index.js -o cnx
```

**Pros:**

- Actively maintained
- Cross-platform support
- Resource embedding support

**Cons:**

- Native modules must be shipped separately
- Requires Python 3 and build tools for source compilation
- Larger binary size

---

## npm Package Naming

Package and binary name availability (checked 2026-01-02):

| Name              | npm Package  | Binary Name | Status                                              |
| ----------------- | ------------ | ----------- | --------------------------------------------------- |
| `cnx`             | —            | ❌ Taken    | Existing package: "work context management utility" |
| `@smeltworks/cnx` | ✅ Available | —           | Scoped to the smeltworks organization               |

**Recommendation:** Use `@smeltworks/cnx` as the package name, since the unscoped `cnx` is taken, and `cnx` as the binary name, which a scoped package still installs (#2164, #2181):

```json
{
  "name": "@smeltworks/cnx",
  "bin": {
    "cnx": "./bin/cnx.js"
  }
}
```

This allows:

```bash
npm install -g @smeltworks/cnx    # Package name
cnx file.cnx                      # Binary name
npx @smeltworks/cnx file.cnx      # npx uses package name
```

---

## Default Output Behavior

Current behavior requires `-o`:

```bash
node dist/index.js input.cnx -o output.c
```

Proposed behavior:

```bash
cnx src/main.cnx        # Entry point (follows includes)
cnx input.cnx -o out.c  # Outputs to specified path
```

### Implementation

```typescript
// If no -o specified, derive output path from input
if (!outputPath && inputFiles.length === 1) {
  outputPath = inputFiles[0].replace(/\.cnx$/, ".c");
}
```

---

## Recommendation

**Phase 1: npm bin (Option A)**

- Package name: `@smeltworks/cnx` (the unscoped `cnx` is taken)
- Binary name: `cnx`
- Add `bin` field to package.json
- Update CLI to default output alongside input
- Publish to npm registry

**Phase 2 (Future): Consider native binary**

- Evaluate Node SEA when it stabilizes (requires ESM→CJS bundling)
- Or consider nexe for cross-platform binaries
- Or consider Bun if ecosystem matures

---

## Decision

**Implemented Phase 1: npm bin (Option A)**

The `cnx` CLI command is available via npm's bin mechanism. Use `npm link` for local development or `npm install -g @smeltworks/cnx` when published.

---

## Implementation Checklist

### Phase 1: npm bin

- [x] Add shebang (`#!/usr/bin/env node`) to src/index.ts
- [x] Add `bin` field to package.json: `"bin": { "cnx": "./dist/index.js" }`
- [x] Update CLI to default output path (same dir as input, `.cnx` → `.c`)
- [x] Add `--version` / `-v` flag (read from package.json)
- [x] Add `--help` / `-h` flag
- [x] Define exit codes (0 = success, 1 = error)
- [x] Add CLI integration tests (`npm run test:cli`)
- [ ] Test cross-platform path handling (Windows backslashes)
- [x] Test `npm link` for local development
- [ ] Test `npx @smeltworks/cnx file.cnx` usage
- [ ] Publish to npm registry
- [x] Update README with installation instructions

---

## References

- [npm bin documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#bin)
- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
- [Node.js SEA GitHub Discussion](https://github.com/nodejs/single-executable/discussions/113)
- [nexe - Create single executables](https://github.com/nexe/nexe)
- [Bun compile](https://bun.sh/docs/bundler/executables)
- [Node.js CLI Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)
