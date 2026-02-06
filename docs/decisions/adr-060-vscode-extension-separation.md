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
- Dependency on transpiler via npm package

## Implementation Plan

### Phase 1: Publish Transpiler as npm Package

Before the extension can be separated, the transpiler must be published as an npm package that the extension can import.

#### 1.1 Create Public API Surface

Create `src/lib/index.ts` exporting the public API:

```typescript
// Public API for external consumers
export { default as transpiler } from './transpiler';
export { default as parseWithSymbols } from './parseWithSymbols';
export type { ISymbolInfo } from './types/ISymbolInfo';
export type { TSymbolKind } from './types/TSymbolKind';
export type { TLanguage } from './types/TLanguage';

// C parser exports (for header file parsing)
export { default as CLexer } from '../transpiler/logic/parser/c/grammar/CLexer';
export { default as CParser } from '../transpiler/logic/parser/c/grammar/CParser';
export { default as CSymbolCollector } from '../transpiler/logic/symbols/CSymbolCollector';
```

#### 1.2 Update package.json Exports

Add exports field to `package.json`:

```json
{
  "name": "@jlaustill/cnext",
  "exports": {
    ".": "./dist/lib/index.js",
    "./parser/c": "./dist/transpiler/logic/parser/c/grammar/index.js"
  },
  "types": "./dist/lib/index.d.ts",
  "files": ["dist/"]
}
```

#### 1.3 Build Configuration

Update build to emit declaration files:

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "./dist",
    "outDir": "./dist"
  },
  "include": ["src/lib/**/*", "src/transpiler/**/*"],
  "exclude": ["**/*.test.ts", "**/__tests__/**"]
}
```

#### 1.4 Publish Workflow Update

Modify `.github/workflows/publish.yml` to build the library before publishing:

```yaml
- name: Build library
  run: npm run build:lib

- name: Publish to npm
  run: npm publish --provenance --access public
```

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
│   ├── extension.ts
│   ├── completionProvider.ts
│   ├── hoverProvider.ts
│   ├── definitionProvider.ts
│   ├── previewProvider.ts
│   ├── scopeTracker.ts
│   ├── utils.ts
│   ├── ExtensionContext.ts
│   ├── __tests__/
│   └── workspace/
│       ├── WorkspaceIndex.ts
│       ├── SymbolCache.ts
│       ├── IncludeResolver.ts
│       └── types.ts
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

#### 2.2 Update Imports

Replace relative parent imports with npm package imports:

```typescript
// Before (relative paths)
import transpiler from '../../src/lib/transpiler';
import parseWithSymbols from '../../src/lib/parseWithSymbols';
import { ISymbolInfo } from '../../src/lib/types/ISymbolInfo';
import CLexer from '../../../src/transpiler/logic/parser/c/grammar/CLexer';

// After (npm package)
import { transpiler, parseWithSymbols, ISymbolInfo } from '@jlaustill/cnext';
import { CLexer, CParser, CSymbolCollector } from '@jlaustill/cnext/parser/c';
```

#### 2.3 Updated package.json

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
    "@jlaustill/cnext": "^0.2.0",
    "antlr4ng": "^3.0.0"
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
    "compile": "esbuild ./src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node",
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
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run prettier:check
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
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
          node-version: '24'
          cache: 'npm'
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
      - 'v*.*.*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

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
          files: '*.vsix'
          generate_release_notes: true
```

#### 3.3 Required Secrets

| Secret | Purpose | How to Obtain |
|--------|---------|---------------|
| `SONAR_TOKEN` | SonarCloud analysis | SonarCloud project settings → Security |
| `VSCE_PAT` | VS Code Marketplace publishing | Azure DevOps → Personal Access Tokens |
| `OVSX_PAT` | Open VSX publishing (optional) | open-vsx.org → Settings → Access Tokens |

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

#### 6.1 Pre-Migration

- [ ] Create and verify npm package `@jlaustill/cnext` exports work
- [ ] Tag and publish transpiler npm package (v0.2.0 or appropriate version)
- [ ] Create `github.com/jlaustill/vscode-c-next` repository
- [ ] Set up SonarCloud project
- [ ] Create VS Code Marketplace publisher (if needed)
- [ ] Create Azure DevOps PAT for `VSCE_PAT`
- [ ] Add all secrets to new repository

#### 6.2 Migration

- [ ] Copy extension files to new repository
- [ ] Update all imports to use `@jlaustill/cnext` package
- [ ] Remove `prebuild` script (no longer needed)
- [ ] Update `repository.url` in package.json
- [ ] Reset version to 1.0.0 for fresh start
- [ ] Create extension icon (128x128 PNG)
- [ ] Update README for marketplace presentation
- [ ] Create initial CHANGELOG.md
- [ ] Set up GitHub branch protection rules
- [ ] Configure SonarCloud quality gate

#### 6.3 Post-Migration

- [ ] Verify CI pipeline passes on first PR
- [ ] Test extension locally from npm dependency
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

### Transpiler Compatibility

The extension's `package.json` will specify a version range:

```json
{
  "dependencies": {
    "@jlaustill/cnext": "^0.2.0"
  }
}
```

When the transpiler makes breaking API changes, the extension will need a corresponding update.

---

## Rollback Plan

If issues arise with the npm package approach:

1. **API Issues**: Add missing exports to `@jlaustill/cnext`, publish patch version
2. **Build Issues**: Extension can temporarily use git submodule as fallback
3. **Marketplace Issues**: Continue distributing `.vsix` files via GitHub Releases

---

## Timeline Estimate

| Phase | Dependencies | Notes |
|-------|--------------|-------|
| Phase 1 | None | Prerequisite for all other phases |
| Phase 2 | Phase 1 complete | Can start once npm package is published |
| Phase 3 | Phase 2 started | Configure alongside repo setup |
| Phase 4 | Phase 2 complete | After first push to new repo |
| Phase 5 | None | Can be done in parallel |
| Phase 6 | All above | Final integration |
| Phase 7 | Phase 6 verified | Only after successful publish |

---

## Consequences

### Positive

- Independent release cycles for extension and transpiler
- VS Code Marketplace distribution (millions of potential users)
- Dedicated code quality tracking and coverage
- Simpler CI/CD with faster feedback loops
- Clear separation of concerns

### Negative

- Two repositories to maintain
- Version coordination between extension and transpiler
- Initial setup overhead for new repo, CI, and secrets
- Potential for version mismatch bugs

### Neutral

- Extension becomes a consumer of the transpiler API (forces good API design)
- Need to define and maintain stable public API surface
