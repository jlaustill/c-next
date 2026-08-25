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

| Status             | Applies to | Means                                                       |
| ------------------ | ---------- | ----------------------------------------------------------- |
| **Backlog**        | Issues     | Filed and untouched. Nobody has picked it up.               |
| **WIP**            | Issues     | Picked up — someone is on it.                               |
| **PR Review**      | PRs        | A pull request is open and waiting to be looked at.         |
| **Changes Needed** | PRs        | Review found something. The PR needs work before it merges. |
| **Ready to Merge** | PRs        | Review is satisfied and CI is green.                        |
| **Done**           | Both       | Closed, or merged.                                          |

An issue travels `Backlog → WIP → Done`. A pull request travels
`PR Review → Changes Needed → Ready to Merge → Done`.

### `Blocked by`

A free-text project field. Empty means not blocked; anything else names what is
in the way — an upstream fix, a pending decision, another issue. Blocked-ness is
_orthogonal_ to position: a blocked issue still sits in Backlog, it just says
why it cannot leave. This replaced the old `status: blocked` label.

---

## What moves a card

| Transition                           | Trigger                        | Mechanism                      |
| ------------------------------------ | ------------------------------ | ------------------------------ |
| _(nothing)_ → **Backlog**            | Issue opened                   | `project-sync.yml`             |
| **Backlog** → **WIP**                | You assign yourself the issue  | `project-sync.yml`             |
| _(nothing)_ → **PR Review**          | PR opened, reopened, or ready  | `project-sync.yml`             |
| **PR Review** → **Changes Needed**   | Review found something         | **Manual**                     |
| **Changes Needed** → **PR Review**   | You pushed the fix             | **Manual**                     |
| _any PR status_ → **Ready to Merge** | Review satisfied, checks green | **Manual**                     |
| _any_ → **Done**                     | Issue or PR closed             | Built-in `Item closed`         |
| _any_ → **Done**                     | PR merged                      | Built-in `Pull request merged` |
| **Done** → **Backlog**               | Issue reopened                 | `project-sync.yml`             |

Automation never drags a card backwards. `project-sync.yml` writes a status only
when the current one is unset or is the status it expects to advance from, so a
card you have moved by hand survives a reopen or a ready-for-review.

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
being released. Work it like any other issue: Backlog → WIP → Done.

Milestones name releases (`v0.4.0`), and nothing else. That keeps "which
release" and "where is the work" as two separate questions with two separate
answers.

The checklist inside the template is the operational one; the reasoning behind
each step lives in [`releasing.md`](../releasing.md).

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
2. Add **PR Review**, **Changes Needed**, **Ready to Merge**.
3. Drag into board order: `Backlog | WIP | PR Review | Changes Needed | Ready to Merge | Done`.

> Never rewrite the option list through `updateProjectV2Field`. That mutation
> replaces the whole list and regenerates every option ID, which orphans each
> item's stored value and every workflow bound to an option.

### 2. Provision the rest (scripted)

```bash
gh auth refresh -s project   # one-time; the default token cannot read Projects
npm run project:setup
```

This creates the project if absent, makes it public, links both repositories,
adds the `Blocked by` field, and seeds every open issue into Backlog and every
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

| Workflow                       | Why off                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Item reopened`                | Fires on issues _and_ pull requests. It would send a reopened PR to Backlog while `project-sync.yml` sends it to PR Review — a race with no defined winner. Reopening is owned by the workflow instead. |
| `Pull request linked to issue` | Forces a linked issue to WIP. WIP here means _you picked it up_, which is self-assignment, not "a PR exists".                                                                                           |
| `Code changes requested`       | Cannot fire — see "Why two transitions are manual".                                                                                                                                                     |
| `Code review approved`         | Cannot fire — same reason.                                                                                                                                                                              |
| `Auto-add to project`          | `project-sync.yml` owns adding, so both repositories behave identically regardless of GitHub plan (Free allows only one auto-add workflow, watching one repository).                                    |

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
