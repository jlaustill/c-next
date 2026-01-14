# Contributing to C-Next

This guide covers the development workflow for contributing to C-Next. We use a branch-based, pull request workflow with automated CI checks to ensure code quality and maintain project stability.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Branch Naming](#branch-naming)
4. [Code Quality Requirements](#code-quality-requirements)
5. [Testing Requirements](#testing-requirements)
6. [Documentation Requirements](#documentation-requirements)
7. [Pull Request Process](#pull-request-process)
8. [Continuous Integration](#continuous-integration)
9. [Code Review Guidelines](#code-review-guidelines)
10. [Commit Guidelines](#commit-guidelines)

---

## Getting Started

### Prerequisites

```bash
# Clone the repository
git clone https://github.com/jlaustill/c-next.git
cd c-next

# Install dependencies
npm install

# Run tests
npm test
```

### Development Setup

**IMPORTANT: Run `npm install` after cloning to install pre-commit hooks!**

The project uses [Husky](https://typicode.github.io/husky/) to automatically format code before every commit. This prevents prettier/eslint errors from reaching PRs.

**What happens when you run `npm install`:**

- ✅ Pre-commit hooks are installed via Husky
- ✅ Prettier automatically formats staged files before commit
- ✅ ESLint automatically fixes staged TypeScript files before commit

**You don't need to manually run `prettier:fix` before commits** - the hook does it for you!

```bash
# Create your feature branch
git checkout -b feature/your-feature-name

# Make changes and test
npm test

# Optional: Manually check code quality (hooks do this automatically)
npm run prettier:fix
npm run eslint:check
npm run typecheck
```

**Bypassing hooks:** Don't use `git commit --no-verify` unless absolutely necessary - this skips formatting and will cause CI failures.

---

## Development Workflow

**C-Next has transitioned from direct commits to main to a PR-based workflow.**

### When to Create a Branch

**Always create a branch for:**

- New features (ADR implementation)
- Bug fixes
- Refactoring
- Documentation changes that affect project behavior

**Emergency hotfixes only** may go directly to main (with team approval).

### Workflow Steps

1. **Create a feature branch** from `main`
2. **Make your changes** following code quality standards
3. **Test thoroughly** using the [Testing Workflow](./TESTING-WORKFLOW.md)
4. **Update documentation** (README, ADRs, learn-cnext)
5. **Create a Pull Request** with complete description
6. **Address review feedback** until approved
7. **Squash and merge** into main

---

## Branch Naming

Use descriptive, lowercase branch names with hyphens:

### Conventions

```bash
# Features (ADR implementation)
feature/adr-NNN-short-name
feature/atomic-variables
feature/critical-sections

# Bug fixes
fix/postfix-chain-ordering
fix/string-concatenation-overflow

# Refactoring
refactor/codegen-simplification
refactor/parser-optimization

# Documentation
docs/contributing-guide
docs/adr-051-division-by-zero

# Testing
test/postfix-chains
test/string-operations
```

### Examples

```bash
# Good
git checkout -b feature/adr-050-critical-sections
git checkout -b fix/bitmap-bit-indexing
git checkout -b docs/update-testing-workflow

# Bad
git checkout -b my-changes        # Too vague
git checkout -b ADR_050           # Wrong case/format
git checkout -b fix               # Not descriptive
```

---

## Code Quality Requirements

**All code must pass linting before merge.**

### Pre-commit Checks

```bash
# REQUIRED: Fix formatting
npm run prettier:fix

# REQUIRED: Check for lint errors
npm run eslint:check

# Fix any ESLint errors in files you modified
# Legacy errors in untouched files can be ignored
```

### Standards

- **TypeScript**: Follow existing code patterns in `src/`
- **Zero TypeScript errors**: All new code must compile cleanly
- **Zero ESLint errors**: In files you touch (fix as you go)
- **Formatting**: Use Prettier (automatic with `prettier:fix`)

### Code Verification

```bash
# Type-check TypeScript
npm run typecheck

# Check generated C compiles (if applicable)
npm run analyze
```

---

## Testing Requirements

**Tests are mandatory for all feature work.**

See [Testing Workflow](./TESTING-WORKFLOW.md) for comprehensive testing methodology.

### Minimum Requirements

1. **Create test files** in `tests/[feature-name]/` as you implement
2. **Follow test progression**: basic → complex → ultimate
3. **Generate expected output**: Create `.expected.c` files for passing tests
4. **Document test status**: Create `tests/[feature-name]/README.md`
5. **Verify no regressions**: All existing tests must pass

### Test Commands

```bash
# Run all tests
npm test

# Run all tests with minimal output (errors + summary only)
npm test -- --quiet    # or: npm test -- -q

# Run specific test directory
npm test -- tests/postfix-chains/

# Run single test file
npm test -- tests/postfix-chains/basic-chaining.test.cnx

# Transpile single test file (without running full test validation)
cnext tests/my-feature/basic.test.cnx

# Verify output matches expected
diff tests/my-feature/basic.c tests/my-feature/basic.expected.c
```

### What to Test

- ✅ Basic usage (2-3 tests)
- ✅ Complex scenarios (3-5 tests)
- ✅ Edge cases (2-3 tests)
- ✅ Error conditions (1-2 tests)
- ✅ Ultimate stress test (1 test)

**Goal:** 8-15 comprehensive tests per feature.

---

## Documentation Requirements

**A task is NOT complete until all relevant documentation is updated.**

### Required Documentation Updates

#### 1. README.md

Update if your changes affect:

- Feature list or examples
- CLI usage or flags
- Installation/setup process
- ADR status (Accepted → Implemented)

#### 2. ADR Files (`docs/decisions/adr-*.md`)

**CRITICAL: NEVER change ADR status without explicit confirmation.**

**You CAN:**

- ✅ Add research findings, links, and context
- ✅ Update "Research Notes" sections
- ✅ Add "Implementation Details" after implementation

**You CANNOT (without approval):**

- ❌ Change Status field (Research/Accepted/Implemented/Rejected)
- ❌ Modify Decision section
- ❌ Change the core proposal

**Documentation Sync Order:**
When implementing a feature, update in this order:

1. **ADR file** (`docs/decisions/adr-NNN.md`) — Add implementation details, mark Implemented
2. **README.md** — Update feature list to reflect ADR is Implemented
3. **learn-cnext-in-y-minutes.md** — Add syntax examples

This prevents README and ADR from getting out of sync.

#### 3. Learn C-Next (`docs/learn-cnext-in-y-minutes.md`)

Update if your changes add:

- New syntax or language features
- New keywords or operators
- New compilation flags or pragmas

**Add:**

- Code examples showing the new feature
- Expected C output
- Common use cases

#### 4. ADR Reference Rules

**Only use Implemented or Accepted ADRs as examples.**

- **Research** ADRs are proposals under investigation (not established syntax)
- **Rejected** ADRs document decisions NOT to implement something
- When explaining "how C-Next does X", only cite Accepted/Implemented ADRs

### Memory Bank Updates

If the project uses a memory bank system, update it with:

- New patterns learned
- Important decisions made
- Workflow improvements discovered

---

## Pull Request Process

### Before Creating a PR

**Pre-flight Checklist:**

```bash
# 1. Code Quality
npm run prettier:fix
npm run eslint:check
npm run typecheck

# 2. Tests
npm test

# 3. Git Status
git status
# Verify: Only files related to your feature are modified
# Ignore: Unrelated changes from parallel work

# 4. Documentation
# - README.md updated (if feature-visible)
# - ADR updated with implementation details
# - learn-cnext-in-y-minutes.md updated (if syntax changed)
# - Test README created (tests/[feature]/README.md)
```

### Creating the PR

#### 1. Commit Your Changes

**ONLY commit files related to your feature.**

```bash
# Stage ONLY related files
git add src/codegen/CodeGenerator.ts
git add grammar/CNext.g4
git add tests/my-feature/
git add docs/decisions/adr-050-critical-sections.md
git add docs/learn-cnext-in-y-minutes.md
git add README.md

# Do NOT stage unrelated changes
# Even if they show up in git status, they're from parallel work
```

**Handling Unrelated Changes:**

- If you see unrelated modified files in `git status`, **IGNORE them**
- **NEVER** revert or checkout unrelated files without explicit direction
- **NEVER** commit unrelated changes as part of your PR
- If unsure whether a change is related, ask for clarification

#### 2. Write a Descriptive Commit Message

See [Commit Guidelines](#commit-guidelines) below.

#### 3. Push Your Branch

```bash
git push origin feature/your-feature-name
```

#### 4. Create Pull Request

**PR Title Format:**

```
[Feature|Fix|Docs|Test]: Short description
```

**Examples:**

```
Feature: Implement critical sections (ADR-050)
Fix: Correct postfix chain member ordering
Test: Add comprehensive string concatenation tests
Docs: Update contributing guide with PR workflow
```

**PR Description Template:**

```markdown
## Summary

[1-3 sentences describing what this PR does]

## Changes

- Added/Modified: [File] - [What changed]
- Added: [Test files] - [What they test]
- Updated: [Docs] - [What was updated]

## Testing

- [ ] All existing tests pass (npm test)
- [ ] New tests added: [N] tests in tests/[feature]/
- [ ] Lint checks pass (eslint:check, prettier:fix)

## Documentation

- [ ] README.md updated (if feature-visible)
- [ ] ADR updated with implementation details
- [ ] learn-cnext-in-y-minutes.md updated (if syntax changed)
- [ ] Test README created

## Related Issues

Closes #NNN (if applicable)
Related to ADR-NNN (if implementing an ADR)

## Checklist

- [ ] No unrelated changes included
- [ ] All documentation requirements met
- [ ] No regressions (existing tests pass)
- [ ] Code quality checks pass
```

### After PR Creation

1. **Wait for CI checks to pass** (required)
2. **Address review feedback** promptly
3. **Keep PR focused** - don't add unrelated changes
4. **Squash commits** if requested during review

---

## Continuous Integration

**All PRs must pass automated CI checks before merging.**

### CI Workflow

The GitHub Actions workflow (`.github/workflows/pr-checks.yml`) automatically runs on every PR and verifies:

1. ✅ **Code Formatting** - `npm run prettier:check`
2. ✅ **Linting** - `npm run eslint:check`
3. ✅ **Type Checking** - `npm run typecheck`
4. ✅ **Tests** - `npm test` (all test suites)
5. ✅ **CLI Smoke Test** - Verify transpiler works on example file

### What This Means

- **Merge button disabled** until all checks pass
- **Green checkmarks** indicate PR is ready for review
- **Red X marks** indicate failures that must be fixed

### When CI Fails

**Check the failing step:**

```bash
# Fix formatting
npm run prettier:fix
git add -A
git commit -m "Fix formatting"
git push

# Fix linting
npm run eslint:fix  # or manually fix issues
git add -A
git commit -m "Fix lint errors"
git push

# Fix type errors
npm run typecheck   # see error messages
# Fix issues, then:
git add -A
git commit -m "Fix type errors"
git push

# Fix test failures
npm test            # see which tests failed
# Fix issues, then:
git add -A
git commit -m "Fix failing tests"
git push
```

### Branch Protection

The `main` branch is protected and requires:

- ✅ All CI checks must pass
- ✅ At least 1 approving review
- ✅ Branch must be up-to-date with main

**Setup:** See `../.github/BRANCH_PROTECTION_SETUP.md` for configuration guide.

---

## Code Review Guidelines

### For Authors

**Responding to Reviews:**

- Address all comments, even if just to explain your reasoning
- Be open to feedback and suggestions
- Make requested changes in new commits (easier to review)
- Mark conversations as resolved after addressing

**What Reviewers Look For:**

- Code quality and correctness
- Test coverage and quality
- Documentation completeness
- No regressions in existing functionality
- Adherence to project patterns

### For Reviewers

**Review Checklist:**

#### 1. Code Quality

- [ ] Code follows existing patterns in the codebase
- [ ] No TypeScript or ESLint errors in modified files
- [ ] Changes are focused and don't include unrelated modifications
- [ ] No debug code left in source (`console.log`, `DEBUG` flags)

#### 2. Testing

- [ ] Tests exist for new functionality
- [ ] Tests follow progression: basic → complex → edge cases
- [ ] `.expected.c` files created for passing tests
- [ ] Test README documents test status
- [ ] All existing tests still pass

#### 3. Documentation

- [ ] README.md updated if feature is user-visible
- [ ] ADR updated with implementation details (if applicable)
- [ ] ADR status changes have explicit approval (if applicable)
- [ ] learn-cnext-in-y-minutes.md updated if syntax changed
- [ ] Code comments explain "why", not "what"

#### 4. Correctness

- [ ] Generated C code is correct and idiomatic
- [ ] No security vulnerabilities introduced
- [ ] Edge cases handled appropriately
- [ ] Error messages are clear and helpful

#### 5. Integration

- [ ] Changes work with existing features
- [ ] No breaking changes to existing syntax
- [ ] Grammar changes don't introduce ambiguity

**Approval Standards:**

- **Approve**: All checklist items pass, no issues found
- **Request Changes**: Critical issues that must be fixed
- **Comment**: Suggestions or questions, but not blocking

---

## Commit Guidelines

### Commit Message Format

```
Short summary (50 chars or less)

Detailed explanation if needed:
- What changed
- Why it changed
- Any important context

Related: ADR-NNN (if applicable)
Fixes: #NNN (if fixing an issue)
```

### Example: Feature Implementation

```
Implement critical sections (ADR-050)

Added `critical { }` block syntax with PRIMASK save/restore:
- Grammar: Added criticalBlock rule
- Codegen: Generate __get_PRIMASK/__set_PRIMASK wrapper
- Semantics: Error on `return` inside critical block (E0853)
- Tests: 9 tests covering basic/nested/error cases

Documentation:
- Updated README.md with critical section example
- Updated ADR-050 with implementation details
- Added examples to learn-cnext-in-y-minutes.md

Testing:
- Test count: 251 → 260 (+9)
- All existing tests pass (no regressions)

Related: ADR-050
```

### Example: Bug Fix

```
Fix postfix chain member ordering bug

Fixed issue where struct members in long chains would be
reordered incorrectly during code generation.

Root cause: Array accumulation in visitPostfixExpression
was being reversed by unshift operations.

Fix: Changed to push + final reverse for correct order.

Tests:
- Added test/postfix-chains/struct-arrays-7-level.test.cnx
- Documents bug in BUG-DISCOVERED-postfix-chains.md

Related: tests/postfix-chains/README.md
```

### Example: Test Addition

```
Add comprehensive string concatenation tests (12 tests)

Tests target lines 4200-4350 in CodeGenerator.ts:
- Basic concatenation (2 tests)
- Capacity validation (3 tests)
- Multi-string chains (2 tests)
- Const string handling (2 tests)
- Error cases (3 tests)

Coverage: 60% → 63% (+3%)
Test count: 251 → 263 (+12)

Files:
- Added: tests/string-concat/ (12 tests + README)
- Updated: docs/coverage.md (section 12.5 + stats)

All existing tests pass (no regressions).
```

### Commit Message Tips

**DO:**

- ✅ Write in imperative mood: "Add feature" not "Added feature"
- ✅ Reference ADRs, issues, or bug docs
- ✅ Explain "why" if not obvious from "what"
- ✅ Include test/coverage changes
- ✅ Note if no regressions

**DON'T:**

- ❌ Write vague messages: "fix bug", "update code"
- ❌ Omit context about why change was needed
- ❌ Forget to mention documentation updates
- ❌ Include unrelated changes

---

## Quick Reference

### Starting New Work

```bash
# 1. Sync with main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Make changes
# [code, test, document]

# 4. Quality checks
npm run prettier:fix
npm run eslint:check
npm run typecheck
npm test

# 5. Stage ONLY related files
git status  # Review what changed
git add [related files only]

# 6. Commit
git commit -m "Descriptive message"

# 7. Push and create PR
git push origin feature/my-feature
# Then create PR on GitHub
```

### Pre-PR Checklist

```bash
# Code Quality
□ npm run prettier:fix
□ npm run eslint:check
□ npm run typecheck
□ npm test (all pass)

# Documentation
□ README.md updated (if needed)
□ ADR updated with implementation details
□ learn-cnext-in-y-minutes.md updated (if syntax changed)
□ Test README created

# Git Hygiene
□ git status shows ONLY related changes
□ Unrelated changes ignored (not reverted/committed)
□ Commit message is descriptive
□ No debug code in source
```

---

## Questions?

- **Project Instructions**: See `/CLAUDE.md`
- **Testing Methodology**: See `/docs/TESTING-WORKFLOW.md`
- **Architecture Decisions**: See `/docs/decisions/adr-*.md`
- **Language Guide**: See `/docs/learn-cnext-in-y-minutes.md`

---

**Last Updated:** 2026-01-11
**Status:** Active - PR-based workflow now required for all contributions
