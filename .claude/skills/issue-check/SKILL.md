---
name: issue-check
description: "Review open GitHub issues for the c-next repo, detect in-flight work (open PRs, assigned issues, recent pushes), and recommend the best issue to tackle next using c-next's label taxonomy and conventions. Use when the user says /issue-check, 'what should I work on', 'check issues', 'next issue', or wants to pick their next task from the backlog."
user-invocable: true
tools: Bash, Read, Grep, Glob, WebFetch, Task, AskUserQuestion
---

# Issue Check — Smart Issue Triage and Recommendation (c-next)

Analyze the c-next repo's open GitHub issues, automatically detect what's already in-flight, and recommend the best issue to tackle next using a heuristic tuned to **this project's actual labels and workflow**. For bug issues, transition into the c-next TDD workflow; for features, into the ADR-first research workflow.

> **Project-specialized skill.** The scoring rubric (Phase 3) is tailored to c-next's labels, board fields and milestone-as-sprint convention. Phase 6 hands off to the `start-issue` skill, which owns the begin-work procedure and the ADR / `.test.cnx` TDD conventions from `CLAUDE.md`.
>
> This file previously claimed to override a personal `issue-check` of the same name. It did not: on a name collision the personal skill won, and everything below — the board query, the sprint filter, the c-next label taxonomy — never ran (#1415). Do not reintroduce a personal skill named `issue-check`; there is no override, only a shadow.

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

#### 1d: Board State (REQUIRED — the board holds facts no label carries)

Where an issue sits, what is blocking it, and which release it ships in live on the
**project board**, not on labels. See [`docs/WORKFLOW.md`](../../../docs/WORKFLOW.md).

```bash
# --paginate is REQUIRED: the board is past 200 items, and a bare
# items(first: 100) truncates silently — every card past the first page
# reads as "not on the board" — no blocker, no status, no sprint.
gh api graphql --paginate -f query='
query($endCursor: String) { user(login: "jlaustill") { projectV2(number: 1) {
  items(first: 100, after: $endCursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
    content { ... on Issue { number } }
    fieldValues(first: 20) { nodes {
      ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
      ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } } } }
  } } } } }' \
  --jq '.data.user.projectV2.items.nodes[] | select(.content.number != null) |
        "\(.content.number)\t\([.fieldValues.nodes[]|select(.field.name=="Status")|.name][0] // "-")\t\([.fieldValues.nodes[]|select(.field.name=="Blocked by")|.text][0] // "")"'
```

```
STORE per issue: BOARD_STATUS, BLOCKED_BY (the raw field text)

RESOLVE blocked-ness. It is DERIVED from what BLOCKED_BY names, never from whether
the field is empty. `Blocked by` is a permanent record of what the work waited on
and is NEVER cleared, so a populated field says nothing on its own about today.

FOR each issue whose BLOCKED_BY is non-empty:
  EXTRACT every issue number (#NNNN) named in the text, and resolve each:
    gh api repos/jlaustill/c-next/issues/<n> --jq '.state'   # open | closed

  THEN read what remains once the references are removed, and judge whether it
  ANNOTATES a named issue — "(PR5-PR7)", "- only blockers",
  "(symbol model: sourceColumn)" — or names a FURTHER blocker of its own,
  "plus the naming decision". Both shapes are on the board today.

    any named issue still open
      → IS_BLOCKED. OPEN_BLOCKERS = those issues.
    all named issues closed, and the remaining text only annotates them
      → NOT blocked. Available. Leave the field alone.
    the text names a further blocker in prose, with or without a reference
      → IS_BLOCKED. OPEN_BLOCKERS = the raw field text — nothing can derive it,
        so print it verbatim for a human to judge.
    you cannot tell which of the previous two it is
      → IS_BLOCKED, and SAY the prose is unresolved rather than guessing.

  NEVER key this on "does the text contain a #NNNN". A field mixing a reference
  with a prose blocker would then go available the moment the reference closed,
  silently dropping a blocker no query can see. OPEN_BLOCKERS is assigned on
  every blocked branch, because both consumers below print it.

IF the query fails (needs `gh auth refresh -s project`):
  SAY SO EXPLICITLY and stop — do not fall back to label-only scoring and
  present it as a recommendation. A ranking that silently ignores Blocked by
  is worse than no ranking, because it looks authoritative.
```

---

### Phase 2: Fetch Open Issues

```bash
# --limit must exceed the open-issue count or the tail is dropped in silence —
# gh returns the most recently updated first, so the oldest simply vanish (#1416).
# The ASSERT below is the part that survives backlog growth; the number alone rots.
gh issue list --state open --limit 1000 --json number,title,labels,milestone,createdAt,updatedAt,comments,body \
  --jq '.[] | {number, title, labels: [.labels[].name], milestone: .milestone.title, created: .createdAt, updated: .updatedAt, comment_count: (.comments | length), body: .body[:300]}'
```

```
ASSERT the returned issue count is strictly less than the --limit above. If it
  equals the limit the list was truncated: SAY SO and stop, rather than ranking a
  backlog you can only partly see.

DETERMINE ACTIVE_MILESTONE = the open milestone with the most open issues
  (this repo uses a milestone as its sprint — see docs/WORKFLOW.md, "Releases are issues")

PARTITION issues into:
  IN_FLIGHT_DISPLAY = open issues that ARE in IN_FLIGHT_ISSUES (for the report)

  EXCLUDED = open issues, each with the reason, where any of:
    - BLOCKED       IS_BLOCKED (Phase 1d)         → name the OPEN_BLOCKERS
    - GROOMING      BOARD_STATUS == "Grooming"    → not triaged; scope is still open
    - EPIC          has the "epic" label          → a tracker, never picked up directly
    - OUT_OF_SPRINT milestone != ACTIVE_MILESTONE → unless --all was passed

  AVAILABLE_ISSUES = everything else

DEFAULT: recommend only from ACTIVE_MILESTONE.
ESCAPE HATCH: `/issue-check --all` drops the OUT_OF_SPRINT exclusion and ranks the
  whole backlog. BLOCKED, GROOMING and EPIC are excluded in BOTH modes.
```

---

### Phase 3: Smart Prioritization (c-next rubric)

Score each AVAILABLE_ISSUE using a weighted heuristic tuned to c-next's label taxonomy.
Higher score = recommend first.

**Note:** there are no `status:` labels. Where an issue sits, what blocks it, and
which release it ships in live on the project board — read in Phase 1d and applied
as *exclusions* in Phase 2, not as score. By the time an issue reaches this rubric it
is already known unblocked, triaged, and in the active sprint. Scoring only ranks
what can actually be started.

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
    "tech-debt"                           → +15   (architecture/duplicate-path work)
    "interop"                             → +12
    "priority: low"                       → +3
    "question"                            → +2
    "epic" / "wontfix" / "test-blocked"   → -100 (skip — see Anti-Patterns)
    "duplicate" / "invalid"               → -100 (skip)

  SPRINT MEMBERSHIP (0-30 points):
    In ACTIVE_MILESTONE                   → +30
    In a different open milestone         → +5
    No milestone                          → +0

    Due dates are NOT scored. This repo does not set them — the milestone names
    the release, and the board status says where the work is. Scoring proximity to
    a date nobody sets gave every issue in a milestone an identical +5, which made
    sprint membership a rounding error.

  COMMUNITY SIGNAL (0-15 points):
    Comment count:
      10+ comments                        → +15
      5-9 comments                        → +10
      2-4 comments                        → +5
      0-1 comments                        → +0

  AGE (0-5 points):
    A mild nudge against stale backlog — deliberately too small to outrank
    sprint membership, which it used to do 3:1.
      > 6 months old                      → +5
      3-6 months old                      → +3
      1-3 months old                      → +2
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

#### Excluded by the Board

Always print this, even when empty. A card skipped silently reads as a card that
does not exist, and the reason it was skipped is usually the useful part.

```
## Not Recommended Yet

| Issue | Reason | Detail |
|-------|--------|--------|
| #1323 | Blocked | #1301, #1319 — both open |
| #1324 | Blocked | #1313 open; #1357 closed, no longer a blocker |
| #1313 | Epic    | tracker; closes when its children do |
| #1374 | Grooming | not triaged — scope still open |

Ranking below covers <ACTIVE_MILESTONE> only. Run `/issue-check --all` for the full backlog.

Detail names the OPEN blockers, not the field text — a closed one is history and
does not belong in a "why this is skipped" column. An earlier version of this
sample read `| #1322 | Blocked | #1316, #1321 |` and
`| #1318 | Blocked | #1285 (PR5-PR7) |`; those values are what #1419 recovered the
two cleared fields from, and `git show 21823602` still carries them.
```

#### Top Recommendations

```
## Recommended: #<number> — <title>

**Score**: <N>/100
**Type**: <bug|validation-bug|enhancement|feature|docs|test-coverage>
**Domain**: <parser|code-generator|types|scope|safety|MISRA|... if labeled>
**Board**: <BOARD_STATUS> · <milestone> · unblocked
**Why this one**:
  - <reason 1: e.g., "priority: high + bug — correctness over convenience">
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

### Phase 6: Begin Work (after user confirms) — hand off to `start-issue`

**Invoke the `start-issue` skill with the chosen issue number.** It owns the whole
begin-work procedure: assign the issue, block until the board reaches `WIP`, derive
blocked-ness, run the dedup gate, deep-read the issue, create the branch, and route
into the TDD or ADR-first workflow.

These steps used to live here in full. They moved so that the two ways of starting work
— picking an issue through this skill, and naming one directly ("start on #1234") —
run the same procedure instead of two copies that must be edited together (#1423).

```
INVOKE: start-issue, with <issue_number>
```

**Do not restate those steps here, and do not re-implement any of them.** In particular
the assignment is not optional and not this skill's to perform: assigning is what moves
the card to `WIP`, and duplicating it here would give the transition two owners.

---

## Decision Trees

### Conflict Detection (domain-label aware)

```
IF a recommended issue shares a DOMAIN label (parser, code-generator, types, scope, ...)
   with an in-flight PR:
  WARN: "Note: #<recommended> (<domain>) overlaps the area of in-flight PR #<pr>.
         There's some conflict risk. Proceed carefully or pick another."
```

### Blocked Work and Sequencing

```
`Blocked by` is free text, not a link — it may name a whole issue ("#1285"), a
specific slice of one ("#1285 PR5 - do PR5 first"), or a pending decision. It is
also a PERMANENT RECORD of what the work waited on. It is NEVER cleared, not even
once every blocker has closed. Never clear it, never replace what it already names,
and never propose either. A new blocker is appended beside the existing text — that
is the only write this field takes.

A populated field is therefore not by itself a reason to skip an issue. Use
IS_BLOCKED from Phase 1d, which asks whether what it names is still open.

NEVER recommend an issue that IS_BLOCKED. Report it under "Not Recommended Yet"
with the OPEN blockers named, so the user can see the chain.

IF every issue in the active milestone is blocked:
  SAY SO, and name the root blockers — that set IS the recommendation.
  "Everything in <milestone> is blocked on #<a> and #<b>. Those are the work."

IF every issue a `Blocked by` names has closed:
  The issue is AVAILABLE and the field is already correct — a resolved blocker is
  history, not a stale value, and there is nothing to fix. Say so when recommending
  it: "unblocked (was: #1316, #1321 — both closed)", so the reader can see the
  field was read rather than ignored.

IF the text qualifies the dependency ("#1285 PR5 - do PR5 first") and #1285 is
still open:
  Derivation cannot see inside it, so the issue stays BLOCKED. Print the qualifier
  verbatim so the user can overrule it.
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
- **DO NOT** pick issues labeled "test-blocked", "wontfix", or "epic"
- **DO NOT** recommend an issue that IS_BLOCKED (its `Blocked by` names something
  still open), or one sitting in `Grooming`
- **DO NOT** clear a `Blocked by`, replace what it names, or propose either — it is a
  permanent record, and a blocker that has closed is history, not a stale value. A new
  blocker is appended beside the old, never substituted for it
- **DO NOT** fall back to label-only scoring when the board query fails — say it failed
  and stop; a ranking that ignores `Blocked by` looks authoritative and is not
- **DO NOT** widen past the active milestone without `--all` — the milestone is the sprint
- **DO NOT** assume issue type from title alone — check labels and body content
- **DO NOT** propose massive refactors as "quick fixes" — scope work to the issue
- **DO NOT** restate or re-implement `start-issue`'s begin-work phases here — the dedup
  gate, the assignment, the branch rules and the TDD/ADR routing live there, and a copy
  in this file is two procedures to keep in step (#1423)

