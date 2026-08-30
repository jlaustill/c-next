# Development Workflow

**A release is work, so it gets managed as work.** There is no separate release
process — a release is an ordinary issue whose purpose happens to be producing
a release, and it rides the same board as everything else. That is why
"Release" is not a board status: the milestone says _which_ release, the status
says where the work is.

This document is the single source of truth for how work moves. `CONTRIBUTING.md`
covers _how to write the change_; this covers _how the change travels_.

The board: **[C-Next project](https://github.com/users/jlaustill/projects/1)** —
it spans [`c-next`](https://github.com/jlaustill/c-next) and
[`vscode-c-next`](https://github.com/jlaustill/vscode-c-next), because a release
that touches the grammar touches the extension too.

---

## The board

Issues and pull requests are **separate cards**. An issue is a unit of work; a
PR is a unit of review. They have a different lifecycle and they finish at
different moments, so conflating them into one card loses information.

| Status             | Applies to | Means                                                                                                                   |
| ------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Grooming**       | Issues     | Just filed. Not triaged — scope, priority and whether it is even right are still open. **Every new issue starts here.** |
| **Backlog**        | Issues     | Groomed and agreed. Ready for someone to pick up.                                                                       |
| **WIP**            | Issues     | Picked up — someone is on it.                                                                                           |
| **PR Review**      | PRs        | A pull request is open and waiting to be looked at.                                                                     |
| **Changes Needed** | PRs        | Review found something. The PR needs work before it merges.                                                             |
| **Ready to Merge** | PRs        | Review is satisfied and CI is green.                                                                                    |
| **Done**           | Both       | Closed, or merged.                                                                                                      |

An issue travels `Grooming → Backlog → WIP → Done`. A pull request travels
`PR Review → Changes Needed → Ready to Merge → Done`.

An issue never travels backwards, and it never comes back from `Done`. **Reopening
a closed issue is not a supported transition.** If a defect turns up after the fix
shipped, that is a new issue with its own reproduction — not a resurrected one. See
[Closed is closed](#closed-is-closed).

### `Blocked by`

A free-text project field. Empty means not blocked; anything else names what is
in the way — an upstream fix, a pending decision, another issue. Blocked-ness is
_orthogonal_ to position: a blocked issue stays in whatever column it is already
in — Grooming or Backlog — it just says why it cannot leave. This replaced the old
`status: blocked` label.

---

## What moves a card

| Transition                            | Trigger                        | Mechanism                      |
| ------------------------------------- | ------------------------------ | ------------------------------ |
| _(nothing)_ → **Grooming**            | Issue opened                   | `project-sync.yml`             |
| **Grooming** → **Backlog**            | Triaged and agreed             | **Manual**                     |
| **Grooming** or **Backlog** → **WIP** | You assign yourself the issue  | `project-sync.yml`             |
| _(nothing)_ → **PR Review**           | PR opened, reopened, or ready  | `project-sync.yml`             |
| **PR Review** → **Changes Needed**    | Review found something         | **Manual**                     |
| **Changes Needed** → **PR Review**    | You pushed the fix             | **Manual**                     |
| _any PR status_ → **Ready to Merge**  | Review satisfied, checks green | **Manual**                     |
| _any_ → **Done**                      | Issue or PR closed             | Built-in `Item closed`         |
| _any_ → **Done**                      | PR merged                      | Built-in `Pull request merged` |

There is deliberately no row for a reopened issue. See
[Closed is closed](#closed-is-closed).

Automation never drags a card backwards. `project-sync.yml` writes a status only
when the current one is unset or is the status it expects to advance from, so a
card you have moved by hand survives a ready-for-review.

## Closed is closed

**Do not reopen a closed issue.** A defect found after the fix shipped is a new
issue, filed with its own reproduction, linking back to the original.

The reason is that an issue is a unit of evidence, not a container. Its title,
reproduction and acceptance criteria describe one defect that was demonstrated and
then fixed. Reopening overwrites that record with a second, different defect that
merely resembles it — and the closed issue's reproduction, which is the part worth
keeping, stops matching what the issue is now about.

`project-sync.yml` does not subscribe to `issues.reopened` and the built-in
`Item reopened` workflow is off, so **nothing moves the card**. A reopened issue is
left visibly stranded in `Done` while being open. That inconsistency is deliberate:
it is how the policy violation surfaces on the board instead of quietly re-entering
the pipeline.

Pull requests are different — a reopened PR does return to `PR Review`, because a
PR is a unit of review and reviewing it twice is ordinary.

### Why two transitions are manual

`Changes Needed` and `Ready to Merge` look like they should be automatic —
GitHub even ships `Code changes requested` and `Code review approved` built-in
workflows for exactly this. **Neither can ever fire here.** GitHub does not let
you approve or request changes on your own pull request, and this repository has
one maintainer, so every review is a `COMMENTED` review. The built-ins would sit
enabled and silent, which is worse than an honest manual move.

They are left **off** on purpose. If this repository ever gains a second
reviewer, turn them on and delete these two rows.

### Closing keywords are load-bearing

`Pull request merged → Done` moves **the PR's own card**. The linked issue moves
because merging closed it, which fires `Item closed`. That chain only exists if
the PR body says `Closes #NNN`. A PR that merges without a closing keyword
leaves its issue sitting in WIP. The pull request template has a **Related
Issues** section for exactly this.

---

## Releases are issues

Open one from the **Release** issue template. Set its milestone to the version
being released. Work it like any other issue: Grooming → Backlog → WIP → Done.

Milestones name releases (`v0.4.0`), and nothing else. That keeps "which
release" and "where is the work" as two separate questions with two separate
answers.

The checklist inside the template is the operational one; the reasoning behind
each step lives in [`releasing.md`](../releasing.md).

### Which release something shipped in is derived, not recorded

**Do not set a milestone to say what has already shipped.** The only milestone
anyone sets by hand is the one on the release issue, which names the version
being prepared. Everything else is written by `npm run release:milestones`,
from a fact about the repository: the first tag containing the merge commit
that closed the item.

It runs at the end of `publish.yml`, so a release attributes itself. The same
command run at any time is also the backfill and the drift check -- one
derivation, no second answer to disagree with the first.

Recorded by hand it drifted, twice over. Every pull request merged from #1327
onward carried no milestone and nothing noticed for four days. And #1157
carried `v0.3.1` while its fix was already an ancestor of the `v0.3.0` tag: it
closed one second after the tag commit, which is not a race a person can be
expected to win.

Two things it will not do, both by design:

- An item closed by hand with no linked commit or pull request is **reported,
  never guessed at**. Two heuristics were measured and both are unsafe -- an
  issue can close months after its fix shipped (#916 closed 2026-06-20; its fix
  shipped in v0.2.7 on 2026-02-23), and a commit can name an issue before
  fixing it.
- A pull request merged into a stack that never landed is `not-shipped`, not
  attributed. GitHub reports #1276 and #1284 as `MERGED`; their code is not on
  `main`. `state: MERGED` conflates merged with shipped, and
  `git merge-base --is-ancestor` does not.

`npm run release:milestones:check` reports drift and writes nothing.

---

## Board setup

Two halves of a GitHub Project can be provisioned from code, and two cannot.
**Views and built-in workflows have no API at all** — not GraphQL, not REST, not
`gh project`. They are UI-only, so they are documented here rather than
scripted.

### 1. Status options (UI, do this first)

New projects ship a `Status` field with `Todo` / `In Progress` / `Done`.

1. **Rename in place** — `Todo` → **Backlog**, `In Progress` → **WIP**. Renaming
   preserves the option's ID, and the built-in workflows are bound to IDs, not
   names. Deleting and recreating silently breaks them.
2. Add **Grooming**, **PR Review**, **Changes Needed**, **Ready to Merge**.
3. Drag into board order: `Grooming | Backlog | WIP | PR Review | Changes Needed | Ready to Merge | Done`.

> Never rewrite the option list through `updateProjectV2Field`. That mutation
> replaces the whole list and regenerates every option ID, which orphans each
> item's stored value and every workflow bound to an option.

### 2. Provision the rest (scripted)

```bash
gh auth refresh -s project   # one-time; the default token cannot read Projects
npm run project:setup
```

This creates the project if absent, makes it public, links both repositories,
adds the `Blocked by` field, and seeds every open issue into Grooming and every
open PR into PR Review. It is idempotent — re-running reports zero changes and
never moves a card that has advanced.

`npm run project:check` reports drift without writing anything.

### 3. Board view (UI)

Create a board view grouped by `Status`.

### 4. Built-in workflows (UI)

Turn **on**:

- `Item closed` → Done
- `Pull request merged` → Done

Leave **off**, and here is why each one:

| Workflow                       | Why off                                                                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Item reopened`                | Fires on issues _and_ pull requests. Reopening an issue is not a supported transition (see [Closed is closed](#closed-is-closed)), and for PRs it would race `project-sync.yml`, which already sends a reopened PR to PR Review. |
| `Pull request linked to issue` | Forces a linked issue to WIP. WIP here means _you picked it up_, which is self-assignment, not "a PR exists".                                                                                                                    |
| `Code changes requested`       | Cannot fire — see "Why two transitions are manual".                                                                                                                                                                              |
| `Code review approved`         | Cannot fire — same reason.                                                                                                                                                                                                       |
| `Auto-add to project`          | `project-sync.yml` owns adding, so both repositories behave identically regardless of GitHub plan (Free allows only one auto-add workflow, watching one repository).                                                             |

### 5. The `PROJECT_TOKEN` secret

`GITHUB_TOKEN` is scoped to the repository and **cannot write Projects v2**.
Fine-grained PATs cannot either — there is no Projects permission for
user-owned projects, and GitHub documents this as a known gap. GitHub Apps need
_organization_ projects permission, which a user-owned project does not have.

That leaves one option: a **classic PAT with the `project` scope**, stored as
`PROJECT_TOKEN` in both repositories.

```bash
gh secret set PROJECT_TOKEN --repo jlaustill/c-next
gh secret set PROJECT_TOKEN --repo jlaustill/vscode-c-next
```

Two things to know:

- **Fork pull requests get no secrets.** `project-sync.yml` skips cleanly rather
  than failing; add a fork PR to the board by hand.
- **Classic PATs expire.** When one does, the workflow fails with a message
  naming the secret rather than a raw GraphQL error. Rotate and re-set it.

### 6. `vscode-c-next`

`project-sync.yml` is a reusable workflow. The extension repository calls it
rather than copying it:

```yaml
name: Project sync
on:
  issues:
    types: [opened, assigned]
  pull_request:
    types: [opened, reopened, ready_for_review]
jobs:
  sync:
    uses: jlaustill/c-next/.github/workflows/project-sync.yml@main
    secrets: inherit
```

---

## Picking what to work on

Run `/issue-check` in Claude Code. It triages open issues, detects in-flight
work, and recommends the highest-value one. Assign yourself the issue you pick —
that is what moves it to WIP.
