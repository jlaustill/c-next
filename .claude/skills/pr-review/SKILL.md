---
name: pr-review
description: "Review a GitHub pull request and leave feedback. Use when the user says /pr-review followed by a PR URL, 'review this PR', 'review pull request', or provides a GitHub PR link for review. Accepts a PR URL as argument."
user-invocable: true
tools: Bash, Read, Grep, Glob, WebFetch, Task, AskUserQuestion
---

# PR Review — Code Review and Comment on a GitHub Pull Request

Review a pull request by URL, analyze all code changes for issues, and post a review with inline comments on specific lines plus a summary.

## Argument Parsing

The user provides a PR URL as the argument. Extract the components:

```
INPUT: https://github.com/{owner}/{repo}/pull/{number}

PARSE:
  OWNER = segment after github.com/
  REPO = next segment
  PR_NUMBER = number after /pull/

IF argument is missing or doesn't match pattern:
  ASK user: "Please provide a PR URL, e.g. /pr-review https://github.com/owner/repo/pull/123"
  STOP

IF argument is just a number (e.g. "745"):
  Use current repo's origin remote to determine OWNER and REPO
  gh pr view {number} --json url to verify it exists
```

---

## Phase 1: Gather PR Context

Collect all information needed to perform the review. Run these in parallel:

```
COMMANDS (run in parallel):
  gh pr view {PR_NUMBER} -R {OWNER}/{REPO} --json title,body,author,baseRefName,headRefName,files,additions,deletions,changedFiles,state
  gh pr diff {PR_NUMBER} -R {OWNER}/{REPO}
  gh pr view {PR_NUMBER} -R {OWNER}/{REPO} --json commits --jq '.commits[] | {messageHeadline: .messageHeadline, oid: .oid[0:8]}'
```

```
REPORT to user (brief):
  PR #{number}: {title} by @{author}
  Base: {baseRefName} ← {headRefName}
  Files changed: {changedFiles} (+{additions} −{deletions})
  Commits: {count}
```

```
IF state != "OPEN":
  WARN user: "This PR is {state}. Reviewing anyway, but comments may not be actionable."
```

---

## Phase 2: Understand the Project

Before reviewing code, understand the project's conventions so feedback is relevant.

```
FETCH project context (run in parallel):
  gh api repos/{OWNER}/{REPO}/contents/CLAUDE.md --jq '.content' | base64 -d 2>/dev/null
  gh api repos/{OWNER}/{REPO}/contents/.claude/CLAUDE.md --jq '.content' | base64 -d 2>/dev/null
  gh api repos/{OWNER}/{REPO}/contents/CONTRIBUTING.md --jq '.content' | base64 -d 2>/dev/null
  gh api repos/{OWNER}/{REPO}/readme --jq '.content' | base64 -d 2>/dev/null

ALSO check:
  gh api repos/{OWNER}/{REPO}/languages — to know primary language(s)
  gh api repos/{OWNER}/{REPO}/contents/package.json --jq '.content' | base64 -d 2>/dev/null — if JS/TS project
  gh api repos/{OWNER}/{REPO}/contents/Cargo.toml --jq '.content' | base64 -d 2>/dev/null — if Rust project

STORE project conventions for use during review.
```

---

## Phase 3: Analyze the Diff

This is the core review phase. Analyze every changed file systematically.

### For Each Changed File

```
FOR each file in the diff:

  1. UNDERSTAND the change:
     - What is this file's purpose?
     - What did the diff add, remove, or modify?
     - Does the commit message explain the intent?

  2. CHECK for issues in these categories:

     BUGS & LOGIC ERRORS (Critical)
       - Off-by-one errors
       - Null/undefined access without guards
       - Race conditions or concurrency issues
       - Incorrect boolean logic
       - Missing error handling on fallible operations
       - Resource leaks (unclosed files, connections, listeners)
       - Integer overflow or type coercion issues

     SECURITY (Critical)
       - Command injection, SQL injection, XSS
       - Hardcoded secrets, credentials, API keys
       - Insecure deserialization
       - Path traversal vulnerabilities
       - Missing input validation at system boundaries
       - Insecure cryptographic usage

     DESIGN & ARCHITECTURE (Important)
       - Breaking single responsibility principle
       - Dual code paths where updating one thing requires updating another
       - Missing abstractions or premature abstractions
       - API design issues (confusing interfaces, breaking changes)
       - Missing or incorrect types

     CODE QUALITY (Moderate)
       - Dead code or unused variables/imports
       - Overly complex logic (could be simplified)
       - Poor naming that obscures intent
       - Missing edge case handling
       - Duplicated logic that should be extracted
       - Inconsistency with project conventions
       - Things done the "easy" way instead of the "right" way
       - Anything that is working around a bug without a TODO comment linking to the bug issue filed

     TESTING (if test files are included)
       - Tests that don't actually assert anything meaningful
       - Missing edge case coverage
       - Flaky test patterns (timing, ordering dependencies)
       - Test descriptions that don't match what's tested

  3. RECORD each finding with:
     - file path
     - line number (from the NEW file, not the diff position)
     - severity: critical | important | moderate | nit
     - category: bug | security | design | quality | testing
     - description: clear, actionable feedback
     - suggestion: what to do instead (when applicable)
```

### Cross-Reference Analysis (Dual Code Paths)

After analyzing individual files, look for changes that require corresponding updates elsewhere. This catches the most impactful review findings — things that compile and pass tests but break at runtime or drift over time.

```
STEP 1: Classify structural changes in the diff

  FOR each changed file, identify if any of these occurred:
    - Field/property added, removed, or renamed on a type/struct/class
    - Enum variant added or removed
    - Function signature changed (params, return type)
    - Config key/option added or removed
    - API route/endpoint added or changed
    - Database schema or model changed
    - Error type or error code added
    - Event name or message type added
    - CLI flag or argument added
    - Permission or role added

STEP 2: Search for counterparts NOT in the diff

  FOR each structural change found in Step 1:

    USE `gh api` or grep-style search to find related code in the repo:

    PATTERN CATALOG — common pairs to check:
    ┌─────────────────────────────┬────────────────────────────────────────────┐
    │ If the PR changes...        │ Check whether these also need updating:    │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ Struct/class fields         │ Serializers, deserializers, builders,      │
    │                             │ mappers, clone/copy methods, equality,     │
    │                             │ debug/display impls, factory functions     │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ Enum variants               │ Switch/match statements, fromString/       │
    │                             │ toString, serialization, display logic,    │
    │                             │ exhaustiveness in handlers                 │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ Function signatures         │ All call sites, interface/trait impls,     │
    │                             │ mocks in tests, documentation             │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ Config/env keys             │ Documentation, .env.example, defaults,    │
    │                             │ validation logic, Docker/CI configs       │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ API routes                  │ OpenAPI/Swagger spec, client SDK,         │
    │                             │ middleware registration, route tests,     │
    │                             │ API docs, permission checks               │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ DB schema/model fields      │ Migrations, seed data, repository layer,  │
    │                             │ DTO mappings, GraphQL schema, API         │
    │                             │ response types                            │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ Error types/codes           │ Error handlers, error documentation,      │
    │                             │ client-side error mapping, i18n strings   │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ Event/message types         │ Event handlers, subscribers, message      │
    │                             │ schema registry, consumer code            │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ CLI flags/arguments         │ Help text, man pages, README usage,       │
    │                             │ shell completions, config file parsing    │
    ├─────────────────────────────┼────────────────────────────────────────────┤
    │ Permissions/roles           │ Auth middleware, role checks, UI          │
    │                             │ conditional rendering, test fixtures      │
    └─────────────────────────────┴────────────────────────────────────────────┘

    SEARCH STRATEGY:
      - gh api --paginate "search/code?q={symbol_name}+repo:{OWNER}/{REPO}" --jq '.items[].path' to find usages
      - If the repo is cloned locally, use grep/ripgrep for faster results
      - Focus on files NOT already in the PR diff — those are the missed updates
      - Check for paired files: if foo.ts changed, did foo.test.ts also change?
        If schema.prisma changed, is there a migration file in the diff?

STEP 3: Record cross-reference findings

  FOR each missing counterpart found:
    RECORD as a finding with:
      - severity: important (most dual-path issues) or critical (data loss risk)
      - category: design
      - description: "This PR adds {X} to {file}, but {counterpart} in {other_file}
                      was not updated. These need to stay in sync because {reason}."
      - suggestion: specific file + what to add/change
      - Place the inline comment on the line in the diff where the change was made,
        referencing the file that also needs updating
```

```
EXAMPLES of good cross-reference comments:

  **[important]** design: This adds a `role` field to `User` (line 45), but
  `UserDTO.fromEntity()` in `user.dto.ts` doesn't map this field.
  The DTO will silently drop the role on API responses.

  **[important]** design: New `ARCHIVED` status added to `ProjectStatus` enum,
  but the switch in `ProjectCard.tsx:89` doesn't handle it — it will fall
  into the default case and render as "Unknown".

  **[critical]** design: New `webhook_secret` config key added to `config.ts`,
  but `.env.example` and the deployment docs in `docs/setup.md` don't mention it.
  Deployments will fail with a missing config error.
```

### Diff Line Mapping

```
IMPORTANT: GitHub's review API uses line numbers from the NEW version of the file.

When creating inline comments:
  - For ADDED lines: use the line number shown in the right side of the diff
  - For MODIFIED lines: use the new line number
  - For DELETED lines: comment on the nearest relevant remaining line,
    or include in the summary instead
  - The "line" field = line number in the file AFTER the PR's changes
  - The "side" field = "RIGHT" for commenting on new/changed code
```

---

## Phase 4: Compose the Review

### Inline Comments

Build the list of inline comments. Each comment should be:

```
FORMAT for inline comments:
  **[{severity}]** {category}: {description}

  {suggestion or code example if applicable}

GUIDELINES:
  - Be specific — reference the exact code, not vague generalities
  - Be actionable — say what to change, not just what's wrong
  - Be respectful — critique the code, not the author
  - For nits, prefix with "Nit:" so the author knows it's minor
  - Group related issues on the same line into one comment
  - Use code suggestions with ```suggestion blocks when possible:

    ```suggestion
    const result = items.filter(isValid);
    ```
```

### Summary Body

```
COMPOSE summary review body:

## Review Summary

**PR:** #{number} — {title}
**Reviewed by:** Claude (automated review)

### Overview
{1-3 sentences: what this PR does and overall assessment}

### Findings

| Severity | Count |
|----------|-------|
| Critical | {N} |
| Important | {N} |
| Moderate | {N} |
| Nit | {N} |

### Key Issues
{List critical and important issues briefly, referencing the inline comments}

### What Looks Good
{Mention 1-3 positive aspects of the PR — good test coverage, clean abstractions, etc.}

{IF no issues found}:
### Verdict
Looks good! No significant issues found.

---
🤖 *Automated review by Claude Code*
```

---

## Phase 5: Submit the Review

Post the review to GitHub using the PR review API.

```
BUILD the review payload:

  If there are inline comments:
    Use `gh api` to submit a review with both body and comments:

    gh api repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/reviews \
      --method POST \
      -f body="{summary}" \
      -f event="COMMENT" \
      --input {comments_json_file}

    Where comments_json_file contains:
    {
      "comments": [
        {
          "path": "src/file.ts",
          "line": 42,
          "side": "RIGHT",
          "body": "**[important]** bug: This can throw if `user` is null.\n\n```suggestion\nconst name = user?.name ?? 'anonymous';\n```"
        }
      ]
    }

  If there are no inline comments (clean PR):
    gh pr review {PR_NUMBER} -R {OWNER}/{REPO} --comment --body "{summary}"
```

### Building the API Payload

```
IMPORTANT: The `gh api` command with --input reads from a file.

STEPS:
  1. Build a JSON object with "body", "event", and "comments" fields
  2. Write it to a temporary file
  3. Submit with: gh api repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/reviews --method POST --input /tmp/review_payload.json
  4. Clean up the temp file

EXAMPLE payload (/tmp/review_payload.json):
{
  "body": "## Review Summary\n...",
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/parser.ts",
      "line": 157,
      "side": "RIGHT",
      "body": "**[critical]** bug: Missing null check..."
    }
  ]
}
```

```
AFTER submission:
  REPORT to user:
    "Review posted on PR #{number}: {url}"
    "Posted {N} inline comments + summary"

  IF submission fails:
    Show the error
    Suggest: "Check that `gh auth status` has write access to {OWNER}/{REPO}"
    Offer to print the review locally instead
```

---

## Review Philosophy

```
PRIORITIES (in order):
  1. Correctness — Does the code do what it claims?
  2. Security — Are there vulnerabilities?
  3. Maintainability — Can others understand and modify this?
  4. Performance — Only flag if there's a real, measurable concern
  5. Style — Only flag if inconsistent with project conventions

DO:
  - Focus on the PR's changed code, not pre-existing issues
  - Consider the context — a prototype has different standards than production code
  - Acknowledge good decisions, not just problems
  - Suggest alternatives, don't just criticize
  - Use code suggestion blocks for concrete fixes
  - Scale review depth to PR size (small PR = deeper review per line)

DO NOT:
  - Nitpick formatting that a linter should catch
  - Suggest rewrites of working code for style preference
  - Flag pre-existing issues outside the PR's diff
  - Leave vague comments like "this could be better"
  - Be condescending or dismissive
  - Review generated/vendored/lockfile changes in detail
  - Request changes (use COMMENT event, not REQUEST_CHANGES — only humans should block merges)
```

## Project-Specific Rules

### C-Next (`.cnx` files)

If reviewing a PR that touches C-Next files, add these checks:

**Rule 1: Fix it upstream, never work around it**
- If C-Next generates wrong/missing code, rejects valid syntax, or lacks a feature,
  the fix must go in c-next, not in the consuming project
- No C/C++ shims, no "de-facto safe" hacks, no avoiding language features
- If a workaround is needed, the PR must include a bug report with minimal reproduction

**Rule 2: No duplicate code paths — the unit is the *decision***
- If changing something in one place requires a corresponding change elsewhere,
  that is a bug in the architecture, not a new PR
- Sharing a detection function is NOT enough if each path derives consequences separately
- Ask: *if this fact changed, how many places would I edit?* If more than one, that is the bug

**Rule 3: Nothing goes under the rug. Fix it or file it. Hard stop.**
- Anything noticed must be either fixed or filed with a minimal reproduction
- "Worth noting" is not a state. "I'll mention it in the summary" is not tracking
- A comment on a related issue is not tracking — it needs its own issue

**Rule 4: Syntax and behavior changes need an ADR and the user's word**
- ADR says X, code does Y → **bug** — fix the code
- ADR says X, X is wrong → **design change** → ADR revision + user approval
- ADR is silent → **ambiguity** → ask, do not assume
- `docs/decisions/` is the authority — read it before concluding something is a bug

**Rule 5: Verify, do not estimate**
- Measure; do not estimate — a grep across `.cnx` files suggested ~119 affected fixtures,
  but prototyping and running the suite gave 67, with **zero** behavioral
- A test that cannot fail proves nothing — mutation-check every guard, probe, or test
- A guard you cannot reach is not a guard — check coverage of contexts, not just behavior
- A measurement needs a control — mutation tables can be contaminated by stale artifacts

**Rule 6: Generated output is derived, never authored**
- `.c`, `.h`, `.cpp`, `.hpp`, `.expected.*` must never be hand-edited
- Change the generator and regenerate
- A conflict-free merge of generated files can produce output no generator would emit
- After merging, regenerate and run the suite
- A snapshot mismatch masks execution — re-run after `npm run test:update` before
  calling a change behavior-preserving
- Emitted code shaped by a standard carries an explanatory comment naming the standard,
  the rule, and *why* the naive form would violate it

**Rule 7: Before declaring it done**
Verify with these commands:
```bash
npm run build && npx tsc --noEmit
npm run unit
npm run test:q
npm run test:bugs
npm run validate:c
npx knip
npm run cspell:check && npm run oxlint:check
```

Then ask:
- Did you **mutation-check** every test and guard you added?
- Can the harness **construct** the contexts this code runs in?
- Would changing one fact require editing **more than one place**?
- Is **everything** you noticed fixed or filed — not just the bugs?
- Are there **zero** open Sonar issues on your code?
- Did you **regenerate** rather than edit or merge any generated file?
- Did you verify each claim in your commit message?
- Does anything you wrote agree with the truth only **by coincidence**?
- If you skipped scope, did you **say so explicitly**?

---

## Anti-Patterns

- **DO NOT** use `REQUEST_CHANGES` or `APPROVE` events — only `COMMENT`. Humans decide merge readiness.
- **DO NOT** review lockfiles, generated code, or vendored dependencies line-by-line.
- **DO NOT** leave comments on lines that aren't part of the diff — GitHub will reject them.
- **DO NOT** guess line numbers — calculate them from the diff hunks.
- **DO NOT** post an empty review if there's nothing to say — at minimum post the summary saying it looks clean.
- **DO NOT** include the PR description verbatim in the summary — synthesize it.
