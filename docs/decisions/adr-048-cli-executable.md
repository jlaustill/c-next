# ADR-048: CLI Executable Distribution

**Status:** Research
**Date:** 2026-01-01
**Decision Makers:** C-Next Language Design Team

## Context

Currently, running the C-Next transpiler requires:

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
npm install -g c-next
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

**Cons:**
- Large binary size (~50MB+)
- Experimental feature
- Complex build process

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

---

## Default Output Behavior

Current behavior requires `-o`:
```bash
node dist/index.js input.cnx -o output.c
```

Proposed behavior:
```bash
cnx input.cnx           # Outputs input.c in same directory
cnx input.cnx -o out.c  # Outputs to specified path
cnx src/*.cnx           # Outputs .c files alongside each .cnx
```

### Implementation

```typescript
// If no -o specified, derive output path from input
if (!outputPath && inputFiles.length === 1) {
    outputPath = inputFiles[0].replace(/\.cnx$/, '.c');
}
```

---

## Recommendation

**Phase 1: npm bin (Option A)**
- Add `bin` field to package.json
- Update CLI to default output alongside input
- Publish to npm as `c-next` or `cnext`

**Phase 2 (Future): Consider native binary**
- Evaluate Node SEA when it stabilizes
- Or consider Bun if ecosystem matures

---

## Decision

**Status: Research** - Awaiting implementation of Phase 1.

---

## Implementation Checklist

- [ ] Add shebang to dist/index.js
- [ ] Add `bin` field to package.json
- [ ] Update CLI to default output path (same dir as input)
- [ ] Test `npm link` for local development
- [ ] Publish to npm registry
- [ ] Update README with installation instructions

---

## References

- [npm bin documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#bin)
- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
- [Bun compile](https://bun.sh/docs/bundler/executables)
