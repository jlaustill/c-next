# ADR-060: VS Code Extension Repository Separation

**Status:** Research
**Date:** 2026-02-06

## Context

The C-Next VS Code extension currently lives in `vscode-extension/` within the main c-next repository. This creates limitations:

1. **Versioning** - Extension versions tied to transpiler releases
2. **CI/CD** - No dedicated pipeline for extension testing or marketplace publishing
3. **Distribution** - Not published to VS Code Marketplace; users must manually install `.vsix` files

## Decision

Separate the VS Code extension into its own repository at `github.com/jlaustill/vscode-c-next` with:

- Independent versioning and releases
- Dedicated CI/CD pipeline with SonarCloud analysis
- Automated publishing to VS Code Marketplace
- **Language server architecture** - transpiler runs as separate process

## Architecture

```
┌─────────────────────┐     JSON/stdin/stdout     ┌─────────────────────┐
│   VS Code Extension │ ◄──────────────────────► │   cnext --serve     │
│   (vscode-c-next)   │                           │   (language server) │
└─────────────────────┘                           └─────────────────────┘
```

**Why separate process?**

| Benefit              | Description                                   |
| -------------------- | --------------------------------------------- |
| **Crash Isolation**  | Transpiler crash doesn't crash VS Code        |
| **Memory Isolation** | Transpiler memory tracked separately          |
| **Testability**      | Server tested independently with stdin/stdout |

---

## Implementation Plan

### Phase 1: Server Mode in Main Repo

Add `--serve` flag to `cnext` that runs a JSON-RPC server on stdin/stdout.

```bash
cnext --serve    # Start server mode
```

#### Server Protocol

Simple JSON-RPC over stdin/stdout. One JSON object per line.

**Request format:**

```json
{
  "id": 1,
  "method": "transpile",
  "params": { "source": "...", "filePath": "test.cnx" }
}
```

**Response format:**

```json
{ "id": 1, "result": { "success": true, "cCode": "...", "headerCode": "..." } }
```

**Methods (v1.0):**

| Method         | Purpose                            |
| -------------- | ---------------------------------- |
| `transpile`    | Transpile source, return C code    |
| `parseSymbols` | Extract symbols from .cnx file     |
| `getVersion`   | Return server and protocol version |
| `shutdown`     | Graceful exit                      |

**Deferred to v2:** `parseCHeader` (extension keeps JS implementation for now)

#### Server Implementation

Create `src/server/`:

```
src/server/
├── CNextServer.ts    # Readline-based request handler
└── protocol.ts       # Type definitions (emerge during implementation)
```

Key implementation notes:

- Read version from `package.json`, not `process.env.npm_package_version`
- `shutdown` must send response before `process.exit(0)`
- Use `readline` interface on stdin, write JSON + newline to stdout

#### CLI Integration

```typescript
// src/index.ts
if (args.includes("--serve")) {
  new CNextServer().start();
} else {
  // existing CLI logic
}
```

#### Testing the Server

```bash
# Manual test
echo '{"id":1,"method":"getVersion","params":{}}' | npx tsx src/index.ts --serve

# Unit tests
npm run unit -- src/server/__tests__/
```

#### Phase 1 Deliverables

- [ ] `src/server/CNextServer.ts` - server implementation
- [ ] `src/server/protocol.ts` - type definitions
- [ ] `--serve` flag in CLI
- [ ] Unit tests for server
- [ ] **STOP AND VALIDATE** - use locally for a week before Phase 2

---

### Phase 2: Extension Uses Server (Still in Main Repo)

Update `vscode-extension/` to spawn the server instead of importing transpiler directly. This validates the architecture before committing to a repo split.

#### Server Client

Create `vscode-extension/src/server/CNextServerClient.ts`:

- Spawn `cnext --serve` as child process
- Track pending requests with timeout (30s default)
- Auto-restart on crash (once, then show error)
- Log to output channel for debugging

**Finding the server binary:**

```typescript
// Try workspace node_modules first, then global
const paths = [
  path.join(workspaceRoot, "node_modules/.bin/cnext"),
  "cnext", // Fall back to PATH
];
```

Note: `require.resolve()` won't work in bundled extension.

#### Graceful Degradation

If server unavailable, extension still provides:

- Syntax highlighting (static, no server needed)
- Snippets
- Language configuration (brackets, comments)

Show warning: "C-Next server not found. Install with: npm i -g @jlaustill/cnext"

#### Extension Settings

Add to `package.json` contributes.configuration:

```json
{
  "cnext.serverPath": {
    "type": "string",
    "default": "",
    "description": "Custom path to cnext binary"
  },
  "cnext.serverTimeout": {
    "type": "number",
    "default": 30000,
    "description": "Request timeout in milliseconds"
  }
}
```

#### File Watching

Invalidate cached symbols when files change:

```typescript
vscode.workspace.onDidChangeTextDocument((e) => {
  if (e.document.languageId === "cnext") {
    symbolCache.invalidate(e.document.uri);
  }
});
```

#### Phase 2 Deliverables

- [ ] `CNextServerClient.ts` in vscode-extension
- [ ] Update all providers to use client
- [ ] Add extension settings
- [ ] Add graceful degradation
- [ ] File watching for cache invalidation
- [ ] Test locally for stability

---

### Phase 3: Repository Separation

Only proceed after Phase 2 is stable.

#### New Repository Structure

```
vscode-c-next/
├── .github/workflows/
│   ├── ci.yml           # PR checks (lint, test, build)
│   └── publish.yml      # Marketplace publish on tags
├── src/
│   ├── extension.ts
│   ├── server/
│   │   └── CNextServerClient.ts
│   └── providers/
├── syntaxes/
│   └── cnext.tmLanguage.json
├── package.json
├── sonar-project.properties
└── README.md
```

#### CI/CD Setup

**ci.yml** - runs on PRs:

- Lint, test, build
- SonarCloud analysis

**publish.yml** - runs on `v*.*.*` tags:

- Build and package
- Publish to VS Code Marketplace

**Required secrets:**

- `SONAR_TOKEN` - SonarCloud
- `VSCE_PAT` - VS Code Marketplace (Azure DevOps PAT with Marketplace scope)

#### Migration Checklist

**Pre-migration:**

- [ ] Phase 1 and 2 complete and stable
- [ ] Create new GitHub repo
- [ ] Set up SonarCloud project
- [ ] Create VS Code Marketplace publisher
- [ ] Add secrets to new repo

**Migration:**

- [ ] Copy extension files
- [ ] Remove `antlr4ng` dependency
- [ ] Update package.json (reset to v1.0.0, update repo URL)
- [ ] Add extension icon (128x128 PNG)
- [ ] Set up branch protection

**Post-migration:**

- [ ] Verify CI passes
- [ ] Tag v1.0.0 to publish
- [ ] Update main repo README to link to marketplace
- [ ] Remove `vscode-extension/` from main repo

---

## Consequences

### Positive

- Independent release cycles
- VS Code Marketplace distribution
- Crash isolation - server crash doesn't crash VS Code
- Simpler extension bundle (no ANTLR runtime)

### Negative

- Two repositories to maintain
- IPC overhead (~5ms per request)
- Server spawn adds ~100-200ms to activation

### Neutral

- Forces good API design (extension becomes consumer)
- All transpiler calls become async (natural for VS Code)

---

## Alternatives Considered

**Direct library import** - Rejected because:

- Parser bugs crash VS Code extension host
- ANTLR runtime significantly increases bundle size
- Sync API doesn't match async VS Code providers
