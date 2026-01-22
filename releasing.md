# Releasing C-Next

This document describes the release process for C-Next.

## Pre-Release Checklist

### 1. Documentation Sync

- [ ] CHANGELOG.md has entry for new version with date
- [ ] ADR files have correct status (Accepted → Implemented when code is complete)
- [ ] README.md ADR table matches ADR file statuses
- [ ] `docs/learn-cnext-in-y-minutes.md` reflects new features (if applicable)

### 2. VS Code Extension (if grammar changed)

- [ ] Sync `tmLanguage.json` with new keywords/types/syntax
- [ ] Sync `completionProvider.ts` keywords with actual C-Next keywords
- [ ] Bump version in `vscode-extension/package.json`

### 3. Version Bump

- [ ] Bump version in `package.json`
- [ ] Run `npm install` to update `package-lock.json`
- [ ] Bump version in `vscode-extension/package.json` (keep in sync)

### 4. Testing

- [ ] `npm test` — all tests pass
- [ ] `npm run analyze` — transpiled output compiles cleanly
- [ ] `npm run typecheck` — no TypeScript errors

### 5. VS Code Extension Build (if updated)

```bash
cd vscode-extension
npm run compile
npx vsce package --allow-missing-repository
code --install-extension c-next-*.vsix --force
```

## Release Workflow

### 1. Create Release Branch and PR

```bash
# Create release branch from main
git checkout main
git pull
git checkout -b release/v0.1.19

# Make release changes (version bump, CHANGELOG, etc.)
# ... edit files ...

# Commit and push
git add .
git commit -m "chore: release v0.1.19"
git push -u origin release/v0.1.19

# Create PR for review
gh pr create --title "Release v0.1.19" --body "Release preparation for v0.1.19"
```

### 2. Review and Merge

- Review the release PR to verify all changes are correct
- Merge the PR into main

### 3. Tag and Publish (Manual)

After merging the release PR:

```bash
# Pull the merged changes
git checkout main
git pull

# Create and push the tag
git tag v0.1.19
git push origin v0.1.19
```

The GitHub Actions workflow will automatically publish to npm when a new tag is pushed.

## CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/):

- `### Added` - new features
- `### Changed` - changes in existing functionality
- `### Fixed` - bug fixes
- `### Removed` - removed features
- `### Deprecated` - features that will be removed
- `### Security` - security fixes

Each version should have a date in format `YYYY-MM-DD`:

```markdown
## [0.1.19] - 2026-01-21

### Added

- New feature description

### Fixed

- Bug fix description (Issue #123)
```

At the bottom, add comparison links:

```markdown
[0.1.19]: https://github.com/jlaustill/c-next/compare/v0.1.18...v0.1.19
```

## ADR Status Transitions

| Transition             | When                                      |
| ---------------------- | ----------------------------------------- |
| Research → Accepted    | Design is approved by team                |
| Accepted → Implemented | Code is complete and tested               |
| Any → Rejected         | Decision made NOT to implement            |
| Any → Superseded       | Replaced by newer ADR (reference new ADR) |

**Important**: Never change ADR status without explicit approval. Update the ADR file FIRST, then update README.md to match.

## Version Numbering

C-Next follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes to language syntax or transpiler output
- **MINOR** (0.x.0): New features, ADR implementations
- **PATCH** (0.0.x): Bug fixes, documentation, tooling improvements

During 0.x.x development, minor versions may include breaking changes.

## Hotfix Process

For urgent fixes:

1. Create branch from main: `git checkout -b hotfix/issue-XXX`
2. Make minimal fix
3. Update CHANGELOG with fix
4. Create PR targeting main: `gh pr create`
5. After review and merge, manually tag the new patch release

## Post-Release

1. Verify npm package published: `npm view c-next versions`
2. Verify GitHub release created with correct tag
3. Test installation: `npm install -g c-next@latest && cnext --version`
