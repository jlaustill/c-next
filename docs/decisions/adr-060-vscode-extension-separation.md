# ADR-060: VS Code Extension Repository Separation

**Status:** Research
**Date:** 2026-02-06

## Context

The C-Next VS Code extension currently lives in `vscode-extension/` within the main c-next repository. This coupling creates several limitations:

1. **Versioning** - Extension versions are tied to transpiler releases; users can't update the extension independently
2. **CI/CD** - No dedicated pipeline for extension testing, quality gates, or marketplace publishing
3. **Code Quality** - No SonarCloud analysis, coverage tracking, or independent quality gates
4. **Distribution** - Extension isn't published to VS Code Marketplace; users must manually install `.vsix` files
5. **Development** - Changes to extension require working in the full transpiler repo

## Decision

Separate the VS Code extension into its own repository at `github.com/jlaustill/vscode-c-next` with:

- Independent versioning and releases
- Dedicated CI/CD pipeline with SonarCloud analysis
- Automated publishing to VS Code Marketplace on version tags
- **Language server architecture** - transpiler runs as separate process (like tsserver)

## Architecture: Language Server Pattern

Following the proven architecture of VS Code's TypeScript extension, the C-Next extension will communicate with a **separate transpiler process** rather than importing the transpiler as a library.

```
┌─────────────────────┐     JSON/stdin/stdout     ┌─────────────────────┐
│   VS Code Extension │ ◄──────────────────────► │   cnext-server      │
│   (vscode-c-next)   │                           │   (language server) │
└─────────────────────┘                           └─────────────────────┘
         │                                                  │
         │ VS Code API                                      │ Transpiler API
         ▼                                                  ▼
┌─────────────────────┐                           ┌─────────────────────┐
│   VS Code Editor    │                           │   C-Next Transpiler │
└─────────────────────┘                           └─────────────────────┘
```

### Benefits of Separate Process Architecture

| Benefit                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| **Crash Isolation**      | Transpiler crash doesn't crash VS Code; server auto-restarts |
| **Memory Isolation**     | Transpiler memory usage tracked separately from extension    |
| **Clean API Boundary**   | JSON protocol forces well-defined, stable interface          |
| **Testability**          | Server can be tested independently of VS Code                |
| **Multi-Editor Support** | Same server could support other editors in future            |
| **Version Independence** | Extension and server can update on different schedules       |

## Implementation Plan

### Phase 1: Add Server Mode to cnext CLI

Add a `--serve` flag to the existing `cnext` binary that runs in language server mode, exposing transpiler functionality via JSON protocol over stdin/stdout.

```bash
# Normal CLI usage
cnext file.cnx                    # Transpile file
cnext file.cnx --cpp              # Transpile to C++

# Server mode for editors
cnext --serve                     # Start JSON-RPC server on stdin/stdout
```

#### 1.1 Server Protocol Definition

Create `src/server/protocol.ts` defining the JSON-RPC protocol:

```typescript
// Request/Response types for cnext-server protocol
export interface IServerRequest {
  id: number;
  method: string;
  params: unknown;
}

export interface IServerResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// Supported methods
export type TServerMethod =
  | "transpile" // Transpile .cnx source to C
  | "parseSymbols" // Extract symbols from .cnx file
  | "parseCHeader" // Parse C header for symbols
  | "validateSource" // Get diagnostics without transpiling
  | "getVersion" // Get server version
  | "shutdown"; // Graceful shutdown

// Method-specific params and results
export interface ITranspileParams {
  source: string;
  filePath: string;
  options?: { cppMode?: boolean };
}

export interface ITranspileResult {
  success: boolean;
  cCode?: string;
  headerCode?: string;
  errors?: IDiagnostic[];
}

export interface IParseSymbolsParams {
  source: string;
  filePath: string;
}

export interface IParseSymbolsResult {
  symbols: ISymbolInfo[];
}

export interface IParseCHeaderParams {
  source: string;
  filePath: string;
}

export interface IParseCHeaderResult {
  symbols: ISymbolInfo[];
}

export interface IDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
}
```

#### 1.2 Server Implementation

Create `src/server/CNextServer.ts`:

```typescript
import * as readline from "node:readline";
import transpiler from "../lib/transpiler";
import parseWithSymbols from "../lib/parseWithSymbols";
import { CSymbolCollector } from "../transpiler/logic/symbols/CSymbolCollector";
import type { IServerRequest, IServerResponse } from "./protocol";

export class CNextServer {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on("line", (line) => this.handleRequest(line));
    this.rl.on("close", () => process.exit(0));
  }

  private async handleRequest(line: string): Promise<void> {
    let request: IServerRequest;
    try {
      request = JSON.parse(line);
    } catch {
      this.sendError(-1, -32700, "Parse error");
      return;
    }

    try {
      const result = await this.dispatch(request);
      this.sendResponse(request.id, result);
    } catch (err) {
      this.sendError(request.id, -32603, String(err));
    }
  }

  private async dispatch(request: IServerRequest): Promise<unknown> {
    switch (request.method) {
      case "transpile":
        return this.transpile(request.params as ITranspileParams);
      case "parseSymbols":
        return this.parseSymbols(request.params as IParseSymbolsParams);
      case "parseCHeader":
        return this.parseCHeader(request.params as IParseCHeaderParams);
      case "validateSource":
        return this.validateSource(request.params as ITranspileParams);
      case "getVersion":
        return {
          version: process.env.npm_package_version ?? "0.0.0",
          protocolVersion: "1.0",
        };
      case "shutdown":
        process.exit(0);
      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  }

  private async transpile(params: ITranspileParams): Promise<ITranspileResult> {
    const result = transpiler.transpileSource(params.source, params.filePath);
    return {
      success: result.success,
      cCode: result.cCode,
      headerCode: result.headerCode,
      errors: result.errors,
    };
  }

  private async parseSymbols(
    params: IParseSymbolsParams,
  ): Promise<IParseSymbolsResult> {
    const symbols = parseWithSymbols(params.source, params.filePath);
    return { symbols };
  }

  private async parseCHeader(
    params: IParseCHeaderParams,
  ): Promise<IParseCHeaderResult> {
    const collector = new CSymbolCollector();
    const symbols = collector.collect(params.source, params.filePath);
    return { symbols };
  }

  private async validateSource(
    params: ITranspileParams,
  ): Promise<{ errors: IDiagnostic[] }> {
    // Parse and validate without generating code
    const result = transpiler.transpileSource(params.source, params.filePath);
    return { errors: result.errors ?? [] };
  }

  private sendResponse(id: number, result: unknown): void {
    const response: IServerResponse = { id, result };
    process.stdout.write(JSON.stringify(response) + "\n");
  }

  private sendError(id: number, code: number, message: string): void {
    const response: IServerResponse = { id, error: { code, message } };
    process.stdout.write(JSON.stringify(response) + "\n");
  }
}
```

#### 1.3 Integrate Server into CLI

Update `src/index.ts` to handle `--serve` flag:

```typescript
// src/index.ts
import { CNextServer } from "./server/CNextServer";

// Parse args
const args = process.argv.slice(2);

if (args.includes("--serve")) {
  // Server mode - start JSON-RPC server on stdin/stdout
  const server = new CNextServer();
  server.start();
} else {
  // Normal CLI mode - transpile files
  // ... existing CLI logic ...
}
```

#### 1.4 No Changes to package.json bin

The existing binary already works - just add the flag handling:

```json
{
  "name": "@jlaustill/cnext",
  "bin": {
    "cnext": "./dist/index.js"
  }
}
```

#### 1.5 Server Module Structure

```
src/
├── index.ts              # CLI entry - routes to server or transpile mode
├── server/
│   ├── CNextServer.ts    # Server implementation (readline + dispatch)
│   └── protocol.ts       # Request/response types
├── lib/
│   └── ...               # Existing transpiler code
└── transpiler/
    └── ...
```

The server code is bundled into the same binary - no separate build step needed.

---

### Phase 2: Create New Repository

#### 2.1 Repository Setup

Create `github.com/jlaustill/vscode-c-next` with:

```
vscode-c-next/
├── .github/
│   └── workflows/
│       ├── ci.yml           # PR checks
│       └── publish.yml      # Marketplace publishing
├── src/
│   ├── extension.ts         # Extension entry point
│   ├── server/
│   │   ├── CNextServerClient.ts    # Server process manager
│   │   ├── protocol.ts             # Shared protocol types
│   │   └── ServerSpawner.ts        # Process lifecycle
│   ├── providers/
│   │   ├── completionProvider.ts
│   │   ├── hoverProvider.ts
│   │   ├── definitionProvider.ts
│   │   └── previewProvider.ts
│   ├── workspace/
│   │   ├── WorkspaceIndex.ts
│   │   ├── SymbolCache.ts
│   │   ├── IncludeResolver.ts
│   │   └── types.ts
│   ├── scopeTracker.ts
│   ├── utils.ts
│   ├── ExtensionContext.ts
│   └── __tests__/
├── syntaxes/
│   └── cnext.tmLanguage.json
├── snippets/
│   └── cnext.json
├── language-configuration.json
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.js
├── .vscodeignore
├── .prettierrc
├── .cspell.json
├── sonar-project.properties
├── README.md
└── CHANGELOG.md
```

#### 2.2 Server Client Implementation

Create `src/server/CNextServerClient.ts` to manage the server process:

```typescript
import * as cp from "node:child_process";
import * as readline from "node:readline";
import * as vscode from "vscode";
import type {
  IServerRequest,
  IServerResponse,
  ITranspileParams,
  ITranspileResult,
  IParseSymbolsParams,
  IParseSymbolsResult,
  IParseCHeaderParams,
  IParseCHeaderResult,
} from "./protocol";

// Configuration constants
const SERVER_REQUEST_TIMEOUT_MS = 30000;
const SERVER_RESTART_DELAY_MS = 1000;
const SERVER_MAX_RESTARTS = 5;
const PROTOCOL_VERSION = "1.0";

export class CNextServerClient implements vscode.Disposable {
  private process: cp.ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeoutId: NodeJS.Timeout;
    }
  >();
  private outputChannel: vscode.OutputChannel;
  private restartCount = 0;
  private isRestarting = false;

  constructor(outputChannel?: vscode.OutputChannel) {
    this.outputChannel =
      outputChannel ?? vscode.window.createOutputChannel("C-Next Server");
  }

  async start(): Promise<void> {
    if (this.process) return;

    const { command, args } = this.findServerCommand();
    this.outputChannel.appendLine(
      `Starting cnext server: ${command} ${args.join(" ")}`,
    );

    this.process = cp.spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.on("exit", (code) => {
      this.outputChannel.appendLine(`Server exited with code ${code}`);
      this.handleServerExit();
    });

    this.process.on("error", (err) => {
      this.outputChannel.appendLine(`Server error: ${err.message}`);
      vscode.window.showErrorMessage(`C-Next server error: ${err.message}`);
    });

    this.process.stderr?.on("data", (data) => {
      this.outputChannel.appendLine(`[stderr] ${data}`);
    });

    this.rl = readline.createInterface({
      input: this.process.stdout!,
      terminal: false,
    });

    this.rl.on("line", (line) => this.handleResponse(line));

    // Verify server is running
    const version = await this.getVersion();
    this.outputChannel.appendLine(`Server started, version: ${version}`);
    this.restartCount = 0;
  }

  private findServerCommand(): { command: string; args: string[] } {
    // Try to find cnext binary
    try {
      const cnextPath = require.resolve("@jlaustill/cnext/dist/index.js");
      return { command: "node", args: [cnextPath, "--serve"] };
    } catch {
      // Fallback to global installation
      return { command: "cnext", args: ["--serve"] };
    }
  }

  private handleServerExit(): void {
    if (this.isRestarting) return; // Prevent overlapping restarts

    this.process = null;
    this.rl = null;

    // Reject all pending requests and clear their timeouts
    for (const { reject, timeoutId } of this.pendingRequests.values()) {
      clearTimeout(timeoutId);
      reject(new Error("Server exited"));
    }
    this.pendingRequests.clear();

    // Auto-restart if under limit
    if (this.restartCount < SERVER_MAX_RESTARTS) {
      this.isRestarting = true;
      this.restartCount++;
      this.outputChannel.appendLine(
        `Restarting server (attempt ${this.restartCount})`,
      );
      setTimeout(() => {
        this.isRestarting = false;
        this.start();
      }, SERVER_RESTART_DELAY_MS);
    } else {
      vscode.window.showErrorMessage(
        "C-Next server crashed repeatedly. Please reload the window.",
      );
    }
  }

  private handleResponse(line: string): void {
    try {
      const response: IServerResponse = JSON.parse(line);
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeoutId); // Clear timeout on response
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (err) {
      this.outputChannel.appendLine(`Failed to parse response: ${line}`);
    }
  }

  private async request<T>(method: string, params: unknown): Promise<T> {
    if (!this.process) {
      await this.start();
    }

    const id = ++this.requestId;
    const request: IServerRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, SERVER_REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });

      this.process!.stdin!.write(JSON.stringify(request) + "\n", (err) => {
        if (err) {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(id);
          reject(err);
        }
      });
    });
  }

  // Public API methods
  async transpile(params: ITranspileParams): Promise<ITranspileResult> {
    return this.request("transpile", params);
  }

  async parseSymbols(
    params: IParseSymbolsParams,
  ): Promise<IParseSymbolsResult> {
    return this.request("parseSymbols", params);
  }

  async parseCHeader(
    params: IParseCHeaderParams,
  ): Promise<IParseCHeaderResult> {
    return this.request("parseCHeader", params);
  }

  async getVersion(): Promise<{ version: string; protocolVersion: string }> {
    return this.request("getVersion", {});
  }

  async checkCompatibility(): Promise<void> {
    const { version, protocolVersion } = await this.getVersion();
    this.outputChannel.appendLine(
      `Server v${version}, protocol v${protocolVersion}`,
    );

    const [serverMajor] = protocolVersion.split(".").map(Number);
    const [clientMajor] = PROTOCOL_VERSION.split(".").map(Number);

    if (serverMajor !== clientMajor) {
      vscode.window.showWarningMessage(
        `C-Next server protocol v${protocolVersion} may be incompatible with extension (expects v${PROTOCOL_VERSION}). Consider updating.`,
      );
    }
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      try {
        await this.request("shutdown", {});
      } catch {
        // Server may have already exited
      }
      this.process.kill();
      this.process = null;
    }
  }

  dispose(): void {
    this.shutdown();
    this.outputChannel.dispose();
  }
}

// Note: No singleton - use dependency injection via extension context
```

#### 2.3 Update Providers to Use Dependency Injection

Providers receive the server client via constructor (no singletons):

```typescript
// Before (direct import)
import transpiler from "../../src/lib/transpiler";
const result = transpiler.transpileSource(source, filePath);

// After (dependency injection)
import { CNextServerClient } from "./server/CNextServerClient";

export class PreviewProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly client: CNextServerClient) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const document = await vscode.workspace.openTextDocument(
      uri.with({ scheme: "file" }),
    );
    const source = document.getText();
    const filePath = document.uri.fsPath;

    const result = await this.client.transpile({ source, filePath });

    if (!result.success) {
      return `// Transpilation errors:\n${result.errors?.map((e) => `// ${e.message}`).join("\n")}`;
    }

    return result.cCode ?? "";
  }
}
```

#### 2.4 Extension Activation

Use dependency injection - create client once, pass to all providers:

```typescript
import * as vscode from "vscode";
import { CNextServerClient } from "./server/CNextServerClient";
import { PreviewProvider } from "./providers/previewProvider";
import { CompletionProvider } from "./providers/completionProvider";
import { HoverProvider } from "./providers/hoverProvider";

export async function activate(context: vscode.ExtensionContext) {
  // Create and start the language server client
  const client = new CNextServerClient();
  await client.start();
  await client.checkCompatibility(); // Verify protocol version
  context.subscriptions.push(client);

  // Register providers with injected client
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "cnext" },
      new CompletionProvider(client),
      ".",
    ),
    vscode.languages.registerHoverProvider(
      { language: "cnext" },
      new HoverProvider(client),
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      "cnext-preview",
      new PreviewProvider(client),
    ),
  );

  // Show server version in status bar
  const { version } = await client.getVersion();
  vscode.window.setStatusBarMessage(`C-Next Server v${version}`, 5000);
}

export function deactivate() {
  // Cleanup handled by context.subscriptions via dispose()
}
```

#### 2.5 Updated package.json

```json
{
  "name": "vscode-c-next",
  "displayName": "C-Next",
  "description": "Syntax highlighting, IntelliSense, and live C preview for C-Next",
  "version": "1.0.0",
  "publisher": "jlaustill",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/jlaustill/vscode-c-next"
  },
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Programming Languages"],
  "keywords": ["c-next", "cnext", "embedded", "systems programming"],
  "icon": "images/icon.png",
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  },
  "main": "./dist/extension.js",
  "dependencies": {
    "@jlaustill/cnext": "^0.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/vscode": "^1.85.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@vscode/vsce": "^3.0.0",
    "esbuild": "^0.24.0",
    "eslint": "^8.57.1",
    "prettier": "^3.7.4",
    "typescript": "^5.3.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  },
  "scripts": {
    "compile": "esbuild ./src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --external:@jlaustill/cnext --format=cjs --platform=node",
    "watch": "npm run compile -- --watch",
    "package": "vsce package --allow-missing-repository",
    "vscode:prepublish": "npm run compile -- --minify",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "prettier:check": "prettier --check ."
  }
}
```

**Note:** The `@jlaustill/cnext` package is a runtime dependency because it includes `cnext-server`. The extension doesn't bundle it - it spawns the server binary at runtime.

---

### Phase 3: CI/CD Pipeline

#### 3.1 PR Checks (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - run: npm run prettier:check
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - run: npm run test:coverage

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - run: npm run compile
      - run: npm run package

  sonar:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - run: npm run test:coverage
      - uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

#### 3.2 Marketplace Publishing (`.github/workflows/publish.yml`)

```yaml
name: Publish to VS Code Marketplace

on:
  push:
    tags:
      - "v*.*.*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Run linter
        run: npm run lint

      - name: Build extension
        run: npm run compile -- --minify

      - name: Package extension
        run: npm run package

      - name: Publish to VS Code Marketplace
        run: npx vsce publish -p ${{ secrets.VSCE_PAT }}

      - name: Publish to Open VSX Registry
        run: npx ovsx publish -p ${{ secrets.OVSX_PAT }} || true
        continue-on-error: true

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: "*.vsix"
          generate_release_notes: true
```

#### 3.3 Required Secrets

| Secret        | Purpose                        | How to Obtain                           |
| ------------- | ------------------------------ | --------------------------------------- |
| `SONAR_TOKEN` | SonarCloud analysis            | SonarCloud project settings → Security  |
| `VSCE_PAT`    | VS Code Marketplace publishing | Azure DevOps → Personal Access Tokens   |
| `OVSX_PAT`    | Open VSX publishing (optional) | open-vsx.org → Settings → Access Tokens |

---

### Phase 4: SonarCloud Setup

#### 4.1 Create Project

1. Go to [sonarcloud.io](https://sonarcloud.io)
2. Add new project → Import from GitHub
3. Select `jlaustill/vscode-c-next`
4. Project key: `jlaustill_vscode-c-next`

#### 4.2 Configuration File

Create `sonar-project.properties`:

```properties
sonar.projectKey=jlaustill_vscode-c-next
sonar.organization=jlaustill
sonar.projectName=vscode-c-next

sonar.sources=src
sonar.tests=src/__tests__
sonar.test.inclusions=**/*.test.ts
sonar.exclusions=**/node_modules/**,**/dist/**

sonar.typescript.lcov.reportPaths=coverage/lcov.info

sonar.coverage.exclusions=**/*.test.ts,**/syntaxes/**,**/snippets/**
```

#### 4.3 Quality Gate

Use default SonarCloud quality gate or customize:

- **Coverage on new code** ≥ 80%
- **Duplicated lines on new code** ≤ 3%
- **No new bugs**
- **No new vulnerabilities**
- **No new security hotspots** (reviewed as safe)

---

### Phase 5: VS Code Marketplace Setup

#### 5.1 Create Publisher

If not already created:

1. Go to [Visual Studio Marketplace Management](https://marketplace.visualstudio.com/manage)
2. Sign in with Microsoft account
3. Create publisher `jlaustill`
4. Verify email address

#### 5.2 Create Personal Access Token

1. Go to [Azure DevOps](https://dev.azure.com/)
2. User Settings → Personal Access Tokens
3. Create new token:
   - Organization: All accessible organizations
   - Scopes: Marketplace → Manage
   - Expiration: 1 year (maximum)
4. Copy token → Add as `VSCE_PAT` secret in GitHub

#### 5.3 Extension Metadata

Add marketplace-required assets:

```
images/
├── icon.png          # 128x128 extension icon
└── preview.gif       # Optional: feature preview animation

README.md             # Becomes marketplace description
CHANGELOG.md          # Shown in marketplace changelog tab
```

---

### Phase 6: Migration Checklist

#### 6.1 Pre-Migration (Main Repo)

- [ ] Implement `src/server/protocol.ts` with JSON-RPC types
- [ ] Implement `src/server/CNextServer.ts` language server class
- [ ] Add `--serve` flag handling to `src/index.ts`
- [ ] Add unit tests for server protocol handling
- [ ] Verify server mode works: `echo '{"id":1,"method":"getVersion","params":{}}' | cnext --serve`
- [ ] Tag and publish transpiler npm package (v0.2.0 or appropriate version)

#### 6.2 Pre-Migration (New Repo Setup)

- [ ] Create `github.com/jlaustill/vscode-c-next` repository
- [ ] Set up SonarCloud project
- [ ] Create VS Code Marketplace publisher (if needed)
- [ ] Create Azure DevOps PAT for `VSCE_PAT`
- [ ] Add all secrets to new repository

#### 6.3 Migration

- [ ] Copy extension files to new repository
- [ ] Implement `CNextServerClient.ts` server process manager
- [ ] Copy `protocol.ts` types (shared between server and client)
- [ ] Update all providers to use async server client instead of direct imports
- [ ] Remove `antlr4ng` dependency (no longer needed - server handles parsing)
- [ ] Remove `prebuild` script (no longer needed)
- [ ] Update `repository.url` in package.json
- [ ] Reset version to 1.0.0 for fresh start
- [ ] Create extension icon (128x128 PNG)
- [ ] Update README for marketplace presentation
- [ ] Create initial CHANGELOG.md
- [ ] Set up GitHub branch protection rules
- [ ] Configure SonarCloud quality gate

#### 6.4 Post-Migration

- [ ] Verify CI pipeline passes on first PR
- [ ] Test extension locally with server process
- [ ] Verify server auto-restart on crash
- [ ] Test server output channel logging
- [ ] Create v1.0.0 tag to trigger first marketplace publish
- [ ] Verify extension appears in VS Code Marketplace
- [ ] Update main c-next README to link to marketplace
- [ ] Remove `vscode-extension/` from main repo (or mark deprecated)
- [ ] Update CLAUDE.md to remove vscode-extension references

---

### Phase 7: Cleanup in Main Repository

After successful migration and first marketplace publish:

#### 7.1 Remove Extension Directory

```bash
git rm -r vscode-extension/
```

#### 7.2 Update Documentation

Update `README.md` to point to marketplace:

```markdown
## VS Code Extension

Install the C-Next extension from the VS Code Marketplace:

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jlaustill.vscode-c-next)
- Or search "C-Next" in VS Code Extensions

Source: [github.com/jlaustill/vscode-c-next](https://github.com/jlaustill/vscode-c-next)
```

#### 7.3 Update CLAUDE.md

Remove:

- VS Code extension caveats section
- Pre-commit hook workaround notes
- References to `vscode-extension/` directory

---

## Versioning Strategy

### Extension Versioning

The extension will follow semantic versioning independently:

- **Major**: Breaking changes to user-facing features
- **Minor**: New features (new commands, providers, settings)
- **Patch**: Bug fixes, dependency updates

### Server Protocol Versioning

The JSON protocol should be versioned for compatibility:

```typescript
// protocol.ts
export const PROTOCOL_VERSION = "1.0";

// Server includes version in handshake
interface IServerInfo {
  version: string; // Server version (e.g., "0.2.0")
  protocolVersion: string; // Protocol version (e.g., "1.0")
}
```

**Compatibility rules:**

- Same major protocol version = compatible
- Extension checks protocol version on startup, warns if mismatch
- New methods can be added without bumping protocol version (minor change)
- Changing existing method signatures requires protocol major bump

### Transpiler Compatibility

The extension's `package.json` will specify a version range:

```json
{
  "dependencies": {
    "@jlaustill/cnext": "^0.2.0"
  }
}
```

When the transpiler makes breaking protocol changes, the extension will need a corresponding update. Non-breaking server improvements (bug fixes, performance) work automatically.

---

## Rollback Plan

If issues arise with the npm package approach:

1. **API Issues**: Add missing exports to `@jlaustill/cnext`, publish patch version
2. **Build Issues**: Extension can temporarily use git submodule as fallback
3. **Marketplace Issues**: Continue distributing `.vsix` files via GitHub Releases

---

## Phase Dependencies

| Phase   | Depends On       | Notes                                   |
| ------- | ---------------- | --------------------------------------- |
| Phase 1 | None             | Prerequisite for all other phases       |
| Phase 2 | Phase 1 complete | Can start once npm package is published |
| Phase 3 | Phase 2 started  | Configure alongside repo setup          |
| Phase 4 | Phase 2 complete | After first push to new repo            |
| Phase 5 | None             | Can be done in parallel                 |
| Phase 6 | All above        | Final integration                       |
| Phase 7 | Phase 6 verified | Only after successful publish           |

---

## Consequences

### Positive

- Independent release cycles for extension and transpiler
- VS Code Marketplace distribution (millions of potential users)
- Dedicated code quality tracking and coverage
- Simpler CI/CD with faster feedback loops
- Clear separation of concerns
- **Crash isolation** - server crash doesn't crash VS Code
- **Memory isolation** - transpiler memory tracked separately
- **Auto-recovery** - server automatically restarts on failure
- **Debuggable** - server output channel shows all communication
- **Future-proof** - same server protocol could support other editors

### Negative

- Two repositories to maintain
- Version coordination between extension and transpiler
- Initial setup overhead for new repo, CI, and secrets
- Potential for version mismatch bugs
- **IPC overhead** - JSON serialization adds latency (typically <5ms)
- **Process management** - more complex than direct imports
- **Startup time** - server spawn adds ~100-200ms to activation

### Neutral

- Extension becomes a consumer of the transpiler API (forces good API design)
- Need to define and maintain stable JSON protocol
- All transpiler calls become async (already natural for VS Code providers)
- Server can be tested independently with simple stdin/stdout tests

---

## Alternative Considered: Direct Library Import

The simpler approach of importing `@jlaustill/cnext` directly was considered but rejected because:

1. **No crash isolation** - parser bugs crash the entire VS Code extension host
2. **Shared memory** - large ASTs share memory with VS Code, harder to debug
3. **Bundling complexity** - ANTLR runtime + parsers significantly increase bundle size
4. **Synchronous API** - transpiler is sync, but VS Code providers are async

The separate process approach adds ~200 lines of client code but provides production-grade reliability matching how VS Code's own TypeScript extension works.
