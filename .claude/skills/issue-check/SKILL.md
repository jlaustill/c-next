---
name: issue-check
description: "Review open GitHub issues for the c-next repo, detect in-flight work (open PRs, assigned issues, recent pushes), and recommend the best issue to tackle next using c-next's label taxonomy and conventions. Use when the user says /issue-check, 'what should I work on', 'check issues', 'next issue', or wants to pick their next task from the backlog."
user-invocable: true
tools: Bash, Read, Grep, Glob, WebFetch, Task, AskUserQuestion
---

# Issue Check — Smart Issue Triage and Recommendation (c-next)

Analyze the c-next repo's open GitHub issues, automatically detect what's already in-flight, and recommend the best issue to tackle next using a heuristic tuned to **this project's actual labels and workflow**. For bug issues, transition into the c-next TDD workflow; for features, into the ADR-first research workflow.

> **Project-specialized skill.** This overrides the generic personal `issue-check` while working in c-next. The scoring rubric (Phase 3) and begin-work workflow (Phase 6) are tailored to c-next's labels, ADR process, and `.test.cnx` TDD conventions from `CLAUDE.md`.

## Execution Workflow

Run these phases in order.

---

### Phase 0: Repo Context

Establish the repo and current state.

```
COMMANDS (run in parallel):
  git remote get-url origin                          # → extract {owner}/{repo}
  git branch --show-current                          # → current branch
  git log --oneline -10                              # → recent work context
```

```
EXTRACT owner/repo from remote URL:
  - HTTPS: https://github.com/{owner}/{repo}.git → {owner}/{repo}
  - SSH: git@github.com:{owner}/{repo}.git → {owner}/{repo}

STORE:
  OWNER_REPO = {owner}/{repo}   (expected: jlaustill/c-next)
```

---

### Phase 1: Detect In-Flight Work

Identify everything currently being worked on so we don't recommend conflicting work.

#### 1a: Open Pull Requests

```bash
# Get all open PRs with their linked issues and branch names
gh pr list --state open --json number,title,headRefName,body,author,updatedAt,labels \
  --jq '.[] | {number, title, branch: .headRefName, author: .author.login, updated: .updatedAt, labels: [.labels[].name], body: .body[:200]}'
```

```
FOR each open PR:
  EXTRACT linked issue numbers from:
    - PR title (e.g., "Fix #123", "#123")
    - PR body (e.g., "Closes #123", "Fixes #123", "Resolves #123", "Part of #123")
    - Branch name (e.g., "fix/123-description", "feature/123-thing", "issue-123")

  STORE as IN_FLIGHT_ISSUES: [{issue_number, pr_number, pr_title, author, domain_labels}]
```

#### 1b: Assigned Issues

```bash
# Issues assigned to anyone
gh issue list --state open --json number,title,assignees,labels,milestone,updatedAt,createdAt,comments \
  --jq '.[] | select(.assignees | length > 0) | {number, title, assignees: [.assignees[].login], labels: [.labels[].name]}'
```

```
ADD assigned issues to IN_FLIGHT_ISSUES (if not already there)
```

#### 1c: Recent Branch Activity

```bash
# Branches with recent pushes that reference issue numbers
git branch -r --sort=-committerdate --format='%(refname:short) %(committerdate:relative)' | head -20
```

```
EXTRACT issue numbers from branch names (e.g., "origin/fix/525-parser-bug" → #525,
  "origin/feature/1075-forbid-loops" → #1075)
ADD to IN_FLIGHT_ISSUES if not already tracked
```

---

### Phase 2: Fetch Open Issues

```bash
# Get all open issues (excluding PRs) with full metadata
gh issue list --state open --limit 50 --json number,title,labels,milestone,createdAt,updatedAt,comments,body \
  --jq '.[] | {number, title, labels: [.labels[].name], milestone: .milestone.title, created: .createdAt, updated: .updatedAt, comment_count: (.comments | length), body: .body[:300]}'
```

```
PARTITION issues into:
  AVAILABLE_ISSUES = open issues NOT in IN_FLIGHT_ISSUES
  IN_FLIGHT_DISPLAY = open issues that ARE in IN_FLIGHT_ISSUES (for the report)
```

---

### Phase 3: Smart Prioritization (c-next rubric)

Score each AVAILABLE_ISSUE using a weighted heuristic tuned to c-next's label taxonomy.
Higher score = recommend first.

#### Scoring Rubric

```
FOR each available issue, compute SCORE:

  LABEL PRIORITY (0-40 points) — take the HIGHEST matching label:
    "priority: high"                      → +40
    "bug"                                 → +30
    "validation-bug"                      → +28   (missing compile-time validation)
    "priority: medium"                    → +20
    "safety" or "MISRA Violations"        → +18   (correctness-critical for embedded)
    "enhancement"                         → +12
    "test-coverage"                       → +10
    "good first issue"                    → +8
    "documentation"                       → +5
    "priority: low"                       → +3
    "question"                            → +2
    "wontfix" / "status: blocked"
       / "test-blocked"                   → -100 (skip — see Anti-Patterns)

  STATUS SIGNAL (0-15 points):
    "status: ready"                       → +15   (explicitly triaged, ready to work)
    "status: investigating"               → +5    (root cause in progress)
    (no status label)                     → +0
    ("status: blocked" already skipped above)

  MILESTONE PROXIMITY (0-20 points):
    Has milestone with due date:
      Due within 7 days                   → +20
      Due within 30 days                  → +15
      Due within 90 days                  → +10
      Overdue                             → +25
    Has milestone without due date        → +5
    No milestone                          → +0

  COMMUNITY SIGNAL (0-15 points):
    Comment count:
      10+ comments                        → +15
      5-9 comments                        → +10
      2-4 comments                        → +5
      0-1 comments                        → +0

  AGE (0-15 points):
    Older issues get slight priority (avoid stale backlog):
      > 6 months old                      → +15
      3-6 months old                      → +10
      1-3 months old                      → +5
      < 1 month old                       → +0

  ESTIMATED COMPLEXITY (0-10 points):
    Prefer medium complexity (good progress, not overwhelming):
      Short body (<100 chars)             → +5 (likely small fix)
      Medium body (100-500 chars)         → +10 (well-scoped)
      Long body (500+ chars)              → +3 (may be complex)
```

```
DOMAIN LABELS (parser, code-generator, types, scope, operators, control-flow,
  interop, embedded, primitives, bitwise-ops, postfix-chains, ...):
  → NOT scored. Used only for conflict detection vs in-flight PRs (see Decision Trees).

RANK available issues by SCORE descending.
```

---

### Phase 4: Present Report

Output a clear, actionable report.

#### In-Flight Work Summary

```
## Currently In-Flight

| Issue | Title | Status | Who |
|-------|-------|--------|-----|
| #525  | Fix parser bug | PR #530 open | @username |
| #510  | Add feature X  | Assigned to @dev | @dev |

These issues are excluded from recommendations to avoid conflicts.
```

#### Top Recommendations

```
## Recommended: #<number> — <title>

**Score**: <N>/100
**Type**: <bug|validation-bug|enhancement|feature|docs|test-coverage>
**Domain**: <parser|code-generator|types|scope|safety|MISRA|... if labeled>
**Why this one**:
  - <reason 1: e.g., "priority: high + status: ready">
  - <reason 2: e.g., "bug label — correctness over convenience">
  - <reason 3: e.g., "8 comments indicate active discussion">
  - <reason 4: e.g., "Well-scoped description suggests medium effort">

**Summary**: <first 2-3 sentences of issue body>

---

### Runners-up

| Rank | Issue | Title | Score | Type |
|------|-------|-------|-------|------|
| 2    | #<n>  | <title> | <score> | <type> |
| 3    | #<n>  | <title> | <score> | <type> |
```

---

### Phase 5: User Decision

```
ASK the user:
  "Want to start on #<recommended>? Or pick a different one from the list?"

  Options:
    1. Start on #<recommended>
    2. Pick a runner-up (show list)
    3. Let me choose a specific issue number
    4. Skip for now
```

---

### Phase 6: Begin Work (after user confirms) — c-next workflow

Once the user selects an issue, follow c-next's `CLAUDE.md` conventions.

#### 6a: Dedup Gate (REQUIRED FIRST)

```bash
# Confirm the issue isn't already done before doing any work
git log --oneline --grep="<issue_number>"
```

```
IF commits reference this issue:
  WARN the user it may already be done; show the commits and confirm before continuing.
```

#### 6b: Deep Read the Issue

```bash
# gh issue view may fail in this repo — use the API directly
gh api repos/jlaustill/c-next/issues/<issue_number> \
  --jq '{title, body, labels: [.labels[].name], milestone: .milestone.title, created_at, state}'

gh api repos/jlaustill/c-next/issues/<issue_number>/comments \
  --jq '.[] | {author: .user.login, created: .created_at, body}'
```

#### 6c: Create the Branch

```
NEVER work on main. Create a feature branch first:
  bug / validation-bug         → fix/<number>-short-description
  enhancement / feature        → feature/<number>-short-description
  documentation / ADR          → docs/<number>-short-description
  test-coverage                → test/<number>-short-description
```

#### 6d: Route by Issue Type

```
CLASSIFY the issue:
  BUG → Phase 6e (TDD workflow)
  ENHANCEMENT/FEATURE/OTHER → Phase 6f (ADR-first planning workflow)

Classification rules:
  - Has "bug", "validation-bug", or "MISRA Violations" label → BUG
  - Title starts with "Fix", "Bug:", "Broken" → BUG
  - Body contains "expected behavior" / "actual behavior" / "steps to reproduce" → BUG
  - Otherwise → ENHANCEMENT/FEATURE/OTHER
```

#### 6e: Bug → c-next TDD Workflow

```
FOR bugs, follow Test-Driven Development with c-next test conventions:

  1. ANALYZE the bug:
     - What is the expected behavior? What is the actual behavior?
     - What layer is affected? (data / logic / output / state — see CLAUDE.md architecture)

  2. WRITE A FAILING TEST FIRST as a .test.cnx with the correct marker:
     - Compile-error bug      → // test-error  + a .expected.error file
     - Wrong runtime behavior → // test-execution (validate every result, unique return codes)
     - Wrong generated code   → .expected.c / .expected.cpp / .expected.h snapshot
     - Place reproduction under tests/ (or bugs/issue-<name>/ for regression cases)
     - Run it (npm test -- <path>) and confirm it FAILS with a useful message

  3. PRESENT THE PLAN:
     "Here's the failing test that proves the bug. Here's my plan to fix it: ..."

  4. WAIT for user approval before implementing the fix.

  5. After approval, implement the fix UPSTREAM (never work around c-next bugs) and verify:
     - The previously failing test now passes
     - npm run test:all is green (or npm run unit + npm test)
     - Commit generated .test.c / .test.h files — they are part of the suite
```

#### 6f: Enhancement/Feature → ADR-First Planning Workflow

```
FOR non-bug issues, research first (CLAUDE.md "Workflow: Research First"):

  1. ANALYZE the requirement and find the relevant ADR(s) in docs/decisions/.
     Only reference Accepted/Implemented ADRs as working syntax.

  2. EXPLORE the codebase for relevant files, patterns, and integration points.
     Respect layer constraints (logic/ cannot import from output/).

  3. UPDATE the ADR with research findings, links, and context as you go.
     NEVER change an ADR's Status or Decision without explicit user approval.

  4. PRESENT THE PLAN:
     "Scope / files to modify / approach / testing strategy / ADR impact"

  5. WAIT for user approval before implementing.
```

#### 6g: Update GitHub Issue & PR

```
THROUGHOUT the work:

  WHEN starting:    gh issue comment <number> --body "Starting work. Approach: <brief plan>"
  ON progress:      gh issue comment <number> --body "Progress: <done / next>"
  WHEN opening PR:  reference the issue ("Fixes #<number>" / "Closes #<number>")
                    All changes go through a PR. Merge with a merge commit — NEVER squash.
```

---

## Decision Trees

### Conflict Detection (domain-label aware)

```
IF a recommended issue shares a DOMAIN label (parser, code-generator, types, scope, ...)
   with an in-flight PR:
  WARN: "Note: #<recommended> (<domain>) overlaps the area of in-flight PR #<pr>.
         There's some conflict risk. Proceed carefully or pick another."
```

### Stale Issues

```
IF an issue has no activity for 12+ months AND no milestone:
  DEPRIORITIZE (but don't hide) — note "stale" in the report
  Suggest the user consider closing it if no longer relevant
```

### Empty Backlog

```
IF no open issues exist:
  "No open issues found. The backlog is clear!
   Consider: reviewing closed issues for follow-ups, or creating new issues for planned work."
```

## Anti-Patterns

- **DO NOT** recommend issues that are clearly in-flight (have open PRs, are assigned, or have recent branch activity)
- **DO NOT** start implementing without user confirmation of which issue to work on
- **DO NOT** skip the dedup gate (`git log --grep`) — issues are sometimes already resolved
- **DO NOT** skip the failing-test step for bugs — the test proves the bug exists
- **DO NOT** work around a c-next bug downstream — fix it upstream in the transpiler
- **DO NOT** change C-Next syntax/behavior or an ADR's Status without explicit ADR approval
- **DO NOT** forget to update the GitHub issue as work progresses
- **DO NOT** pick issues labeled "status: blocked", "test-blocked", or "wontfix"
- **DO NOT** assume issue type from title alone — check labels and body content
- **DO NOT** propose massive refactors as "quick fixes" — scope work to the issue
- **DO NOT** squash-merge — always use a merge commit
