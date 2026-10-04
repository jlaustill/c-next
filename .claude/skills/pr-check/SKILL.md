---
name: pr-check
description: "Comprehensive PR health check. Use when the user says /pr-check, 'check the PR', 'fix PR issues', 'check CI', 'fix sonar issues', 'PR feedback', or wants to resolve all outstanding issues on their current pull request — including review comments, SonarCloud/SonarQube issues, and failing CI checks."
user-invocable: true
tools: Bash, Read, Edit, Grep, Glob, Write, WebFetch, Task, AskUserQuestion
---

# PR Check — Comprehensive Pull Request Health Check

Systematically resolve ALL outstanding issues on the current PR: review feedback, SonarCloud/SonarQube issues, CI failures, and any other required checks. The goal is a green, mergeable PR.

## Quality Standards

These standards are NON-NEGOTIABLE — they exceed typical quality gate minimums:

| Metric | Target | Typical Gate Minimum |
|--------|--------|---------------------|
| New Sonar issues | **0** | N/A |
| Coverage on new code | **90%+** | 80% |
| Duplicated lines (new) | **0%** | 3% |
| Cognitive complexity | **≤15 per method** | 15 |

## Execution Workflow

Run these phases in order. Each phase produces a status report before moving to the next.

---

### Phase 0: Orientation & Project Discovery

Establish context before doing anything else. Discover what tools and conventions this project uses.

#### 0a: PR Context

```
COMMANDS (run in parallel):
  git branch --show-current
  git log --oneline -5
  gh pr view --json number,title,state,statusCheckRollup,reviewDecision,url
  gh pr view --json reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body}'
```

```
IF no PR exists for current branch:
  STOP — inform user "No PR found for this branch. Create one first."

REPORT:
  PR #<number>: <title>
  URL: <url>
  Review decision: <APPROVED|CHANGES_REQUESTED|REVIEW_REQUIRED>
  Checks: <N passing, N failing, N pending>
```

#### 0b: Project Discovery

Detect the project's tooling, test commands, and code quality setup. This drives all subsequent phases.

```
DISCOVER (check these files — read what exists):

  Sonar config (pick first found):
    - sonar-project.properties → extract sonar.projectKey, sonar.organization
    - .sonarcloud.properties
    - sonar-project.properties in any subdirectory
    - pom.xml → look for <sonar.projectKey>
    - build.gradle / build.gradle.kts → sonar plugin config

  Package manager & scripts:
    - package.json → scripts section (test, lint, coverage, build commands)
    - Makefile / Taskfile.yml → available targets
    - Cargo.toml → Rust project (cargo test, cargo clippy)
    - pom.xml / build.gradle → Java/Kotlin project (mvn test, gradle test)
    - pyproject.toml / setup.py / tox.ini → Python project (pytest, ruff, mypy)
    - go.mod → Go project (go test, golangci-lint)

  CI workflows:
    - .github/workflows/*.yml → GitHub Actions jobs and steps
    - .gitlab-ci.yml → GitLab CI
    - Jenkinsfile → Jenkins
    - .circleci/config.yml → CircleCI

  Project instructions:
    - CLAUDE.md → project-specific conventions, commands, quality requirements
    - .claude/CLAUDE.md → additional instructions
    - CONTRIBUTING.md → contribution guidelines

STORE discovered values for use in later phases:
  SONAR_PROJECT_KEY = <from config or "not configured">
  SONAR_ORG = <from config or "not configured">
  SONAR_HOST = <sonarcloud.io or custom host>
  TEST_CMD = <discovered test command>
  COVERAGE_CMD = <discovered coverage command>
  LINT_CMD = <discovered lint command>
  FORMAT_CMD = <discovered format command>
  BUILD_CMD = <discovered build command>
```

```
IF CLAUDE.md exists:
  Read it — it may override quality standards or define project-specific
  commands and conventions. CLAUDE.md instructions take precedence over
  the defaults in this skill.
```

#### 0c: Merge Conflict Check

Check for merge conflicts before doing any fix work — a conflicted PR cannot be merged regardless of other improvements.

```
COMMANDS (run in parallel):
  gh pr view --json mergeable,mergeStateStatus
  git fetch origin <base_branch>
  git merge-tree $(git merge-base HEAD origin/<base_branch>) HEAD origin/<base_branch>

EVALUATE:
  IF mergeable == "CONFLICTING" or mergeStateStatus == "DIRTY":
    1. Identify conflicting files:
       git diff --name-only --diff-filter=U origin/<base_branch>...HEAD
       # Or parse the merge-tree output for conflict markers

    2. REPORT conflicts to user:
       "⚠ PR has merge conflicts in N file(s):"
       List each conflicting file

    3. ASK user:
       "Merge conflicts must be resolved before the PR can merge."
       Options:
         1. Rebase onto <base_branch> and resolve conflicts now
         2. Skip — I'll resolve conflicts manually later
         3. Continue with other checks anyway (conflicts remain)

    IF user chooses option 1:
      git rebase origin/<base_branch>
      Help resolve conflicts file-by-file:
        - Show conflict markers and both sides
        - Suggest resolution based on context
        - WAIT for user approval on each conflict
      git rebase --continue after each resolution
      Verify: git diff --check (no remaining conflict markers)

    IF user chooses option 2:
      STOP — inform user to re-run /pr-check after resolving conflicts

    IF user chooses option 3:
      CONTINUE with remaining phases, but note conflicts in final report

  IF mergeable == "MERGEABLE" or mergeStateStatus == "CLEAN":
    "✓ No merge conflicts detected."
    CONTINUE to Phase 1
```

---

### Phase 1: Review Feedback

Fetch and process ALL review comments — both top-level reviews and inline code comments.

```
COMMANDS (run in parallel):
  gh api --paginate repos/{owner}/{repo}/pulls/{pr_number}/reviews
  gh api --paginate repos/{owner}/{repo}/pulls/{pr_number}/comments
  gh pr view --json comments --jq '.comments[] | {author: .author.login, body: .body}'
```

#### Processing Each Comment

```
FOR each unresolved review comment:

  1. READ the file and surrounding context
  2. UNDERSTAND: Restate the requirement technically
  3. VERIFY: Check against codebase reality and project conventions

  CLASSIFY the feedback:
    CLEAR_AND_CORRECT → Implement the fix
    CLEAR_BUT_QUESTIONABLE → Flag for user decision (see below)
    UNCLEAR → Flag for user decision (see below)
    ALREADY_ADDRESSED → Note it, move on
    NOT_APPLICABLE → Note it, move on
```

#### Flagging Questionable Feedback

```
IF feedback seems wrong, outdated, or conflicts with project conventions:
  DO NOT silently implement it
  DO NOT silently ignore it

  PRESENT to user:
    Comment: "<exact reviewer quote>"
    File: <path:line>
    Assessment: <why this seems questionable>
    Options:
      1. Implement as requested
      2. Push back with reasoning: "<draft response>"
      3. Skip for now
      4. Let me explain the context (user provides direction)

  WAIT for user direction before proceeding
```

#### Replying to Review Comments

After implementing fixes, reply in the GitHub thread:

```bash
# Reply to inline review comment
gh api -X POST repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies \
  -f body="Fixed. <brief description of change>"

# Reply to top-level review comment
gh api -X POST repos/{owner}/{repo}/issues/{pr_number}/comments \
  -f body="Addressed review feedback: <summary>"
```

**Reply tone:** Brief and factual. No performative agreement. State what changed.

---

### Phase 2: SonarCloud/SonarQube Issues

Check for ALL Sonar issues on the PR — not just quality gate failures. Target is **zero new issues**.

**Skip this phase if SONAR_PROJECT_KEY is "not configured".**

#### 2a: Fetch Issues

```bash
# Determine the Sonar host (sonarcloud.io or self-hosted)
# Use SONAR_PROJECT_KEY and SONAR_HOST from Phase 0 discovery

# Pull request issues (new code only)
curl -s "${SONAR_HOST}/api/issues/search?componentKeys=${SONAR_PROJECT_KEY}&pullRequest=${pr_number}&statuses=OPEN,CONFIRMED&ps=100" \
  | jq '.issues[] | {rule, severity, message, component: (.component | split(":")[1]), line, effort}'

# If no PR-specific results, check branch issues
curl -s "${SONAR_HOST}/api/issues/search?componentKeys=${SONAR_PROJECT_KEY}&branch=${branch_name}&statuses=OPEN,CONFIRMED&ps=100&createdAfter=${branch_creation_date}" \
  | jq '.issues[] | {rule, severity, message, component: (.component | split(":")[1]), line, effort}'
```

**Note:** SonarQube on-prem may require authentication tokens. If API calls return 401/403, inform the user and suggest setting `SONAR_TOKEN` or checking access.

#### 2b: Categorize and Fix

```
FOR each Sonar issue, categorize:

  CODE_SMELL → Fix directly
    - Cognitive complexity: Extract helper methods, use early returns
    - Duplicate code: Extract shared utility
    - Unused imports/variables: Remove them
    - Style issues: Follow project conventions from CLAUDE.md

  BUG → Fix with extra care, verify with tests
    - Type coercion issues
    - Null/undefined access
    - Logic errors

  VULNERABILITY / SECURITY_HOTSPOT → Fix immediately
    - Review security context
    - Apply secure coding patterns

  COVERAGE → Write tests (see Phase 2c)
```

**Cognitive Complexity Reduction Pattern:**
```
IF method complexity > 15:
  1. Identify nested logic blocks
  2. Extract to private helper methods with descriptive names
  3. Use early returns to reduce nesting
  4. Move self-contained loops to utility methods
  5. Verify extracted helpers are tested
```

#### 2c: Coverage Check

```
Run COVERAGE_CMD discovered in Phase 0.

Common patterns:
  - npm/node: npm run coverage, npm run test:coverage, npx vitest --coverage
  - Python: pytest --cov, coverage run -m pytest
  - Java: mvn test jacoco:report, gradle jacocoTestReport
  - Go: go test -coverprofile=coverage.out ./...
  - Rust: cargo tarpaulin, cargo llvm-cov

IF coverage on new code < 90%:
  1. Identify uncovered lines in changed files
  2. Write targeted tests for uncovered paths
  3. Focus on: error paths, edge cases, branch conditions
  4. Follow the project's test file placement conventions
  5. Re-run coverage to verify improvement

COVERAGE STRATEGY:
  - Extract complex private methods to testable helpers
  - Test helpers with high coverage
  - Remove genuinely dead code (improves coverage for free)
  - Type-only/interface files at 0% are OK — no executable code
```

#### 2d: Duplication Check

```
IF project has a duplication analysis command (from Phase 0 discovery):
  Run it and check results

IF duplicated lines > 0% on new code:
  1. Identify duplicate blocks
  2. Extract to shared utility or helper
  3. Follow project conventions for utility placement
  4. Ensure extracted code has tests
```

---

### Phase 3: CI Check Status

Review ALL required checks, not just Sonar.

```bash
# Get all check statuses
gh pr checks --json name,state,description,link

# Or via API for more detail
gh api --paginate repos/{owner}/{repo}/commits/{head_sha}/check-runs \
  --jq '.check_runs[] | {name, status, conclusion, output: .output.summary}'
```

#### Fixing Failing Checks

```
FOR each failing check:

  1. READ the failure output from CI logs:
     gh api repos/{owner}/{repo}/check-runs/{check_run_id} \
       --jq '.output.text // .output.summary'

     If logs are truncated, check the CI link directly.

  2. IDENTIFY the local equivalent command:
     - Match the check name to commands discovered in Phase 0
     - Read the CI workflow file if needed to find the exact command
     - Common mappings:
       lint/format → FORMAT_CMD or LINT_CMD
       test/unit   → TEST_CMD
       build       → BUILD_CMD
       coverage    → COVERAGE_CMD
       typecheck   → tsc --noEmit, mypy, pyright, etc.

  3. REPRODUCE locally with the matching command

  4. FIX the root cause

  5. VERIFY the fix locally

  6. Move to next failing check
```

---

### Phase 4: Final Verification

Before declaring the PR healthy, run the full local verification suite using discovered commands.

```
Run ALL discovered check commands in sequence — each must pass before the next:

  1. FORMAT_CMD (if discovered) — fix formatting issues
  2. LINT_CMD (if discovered) — fix lint errors
  3. BUILD_CMD (if discovered) — verify compilation
  4. TEST_CMD (if discovered) — run test suite
  5. COVERAGE_CMD (if discovered) — verify coverage meets 90%+ target
  6. Any additional check commands found in CI workflows

REPORT final status:
  ✓/✗ Merge conflicts
  ✓/✗ Format/Lint
  ✓/✗ Build
  ✓/✗ Tests (coverage: XX% on new code)
  ✓/✗ Duplication
  ✓/✗ Sonar issues (N remaining)
  ✓/✗ Review feedback (N comments addressed, N flagged)

IF all passing:
  "PR is healthy. Ready for review/merge."

IF any failing:
  List remaining issues with suggested next steps
```

---

### Phase 5: Push and Monitor

```
AFTER all local checks pass:
  ASK user: "All local checks pass. Push to update the PR?"

  IF user approves:
    git push
    Wait 30 seconds
    gh pr checks — report initial CI status

  IF user declines:
    Show summary of changes made, let user decide next steps
```

---

## Decision Trees

### When to Ask vs. Act

```
ASK the user when:
  - Review feedback contradicts project conventions (CLAUDE.md)
  - Review feedback conflicts with existing architectural decisions
  - Reviewer suggests adding features (YAGNI check)
  - You can't verify if a suggestion is correct
  - Sonar flags something that seems like a false positive
  - A fix would require significant refactoring (>50 lines changed)
  - Multiple valid approaches exist for a fix

ACT autonomously when:
  - Fix is straightforward (typo, import, formatting)
  - Sonar issue has a clear, safe resolution
  - Coverage gap has an obvious test to write
  - Lint/format/spell issues with clear fixes
```

### Handling Stale Sonar Data

```
IF Sonar shows no PR-specific issues but quality gate failed:
  1. Check if analysis has completed (may be pending)
  2. Fall back to branch-level issue query
  3. Cross-reference with local analysis tools
  4. Run COVERAGE_CMD locally as source of truth for coverage
```

### Projects Without Sonar

```
IF no Sonar configuration found:
  Skip Phase 2 entirely
  Rely on CI checks (Phase 3) and local verification (Phase 4)
  Still enforce 90%+ coverage target using local coverage tools
  Inform user: "No SonarCloud/SonarQube config detected — skipping Sonar phase."
```

## Anti-Patterns

- **DO NOT** blindly implement all review feedback — evaluate each item
- **DO NOT** aim for just the quality gate minimum — our standard is higher
- **DO NOT** skip phases — even if one area looks clean, verify it
- **DO NOT** push without running full local verification
- **DO NOT** skip merge conflict detection — a conflicted PR blocks merging regardless of all other checks passing
- **DO NOT** ignore coverage on "simple" code — all new code needs tests
- **DO NOT** add coverage skip comments (`istanbul ignore`, `c8 ignore`, `pragma: no cover`, `#[cfg(not(tarpaulin_include))]`) to dodge coverage
- **DO NOT** write trivial tests just to hit coverage numbers — tests must verify behavior
- **DO NOT** assume npm/node — always use the commands discovered in Phase 0
