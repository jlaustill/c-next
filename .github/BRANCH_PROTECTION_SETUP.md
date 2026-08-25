# Branch Protection Setup Guide

`main` is governed by a **repository ruleset**, not a classic branch protection
rule. Rulesets live under **Settings → Rules → Rulesets**; the older
**Settings → Branches** page does not show them.

This guide records what the ruleset enforces and how to rebuild it.

---

## What is enforced

| Rule                      | Setting                                                 |
| ------------------------- | ------------------------------------------------------- |
| Target                    | Default branch (`main`)                                 |
| Enforcement               | Active                                                  |
| Restrict deletions        | On — `main` cannot be deleted                           |
| Block force pushes        | On — non-fast-forward pushes are rejected               |
| Require a pull request    | On, with **0 required approving reviews**               |
| Allowed merge methods     | **Merge commit only** — squash and rebase are disabled  |
| Required status checks    | `All Checks Passed`, `SonarCloud Code Analysis`         |
| Require branch up to date | **Off** (`strict_required_status_checks_policy: false`) |

### Why zero required approvals

The repository has one maintainer, and GitHub does not allow approving your own
pull request. Requiring an approval would block every merge outright. The gate
here is CI, not a second pair of eyes.

This is the same constraint that makes `Changes Needed` and `Ready to Merge`
manual moves on the project board — see [`docs/WORKFLOW.md`](../docs/WORKFLOW.md).

### Why merge commits only

`git log --first-parent` stays a readable list of merged changes, and the
individual commits of a branch survive. See the "Never squash-merge" rule in
`CLAUDE.md`.

---

## Rebuilding the ruleset

Read the live configuration at any time:

```bash
gh api repos/jlaustill/c-next/rulesets
gh api repos/jlaustill/c-next/rulesets/<id> --jq '{name, enforcement, rules}'
```

To recreate it through the UI:

1. **Settings → Rules → Rulesets → New ruleset → New branch ruleset**
2. Name it `main`, set **Enforcement status** to **Active**
3. Under **Target branches**, add **Include default branch**
4. Enable:
   - **Restrict deletions**
   - **Block force pushes**
   - **Require a pull request before merging** — set **Required approvals** to
     `0`, leave the dismissal and code-owner options off, and under **Allowed
     merge methods** select **Merge** only
   - **Require status checks to pass** — add `All Checks Passed` and
     `SonarCloud Code Analysis`, and leave **Require branches to be up to date
     before merging** unchecked
5. **Create**

> Status checks only appear in the picker after the workflow producing them has
> run at least once on the repository.

---

## Verifying it works

Open any pull request and confirm:

- Both required checks appear and must pass before the merge button enables
- **Squash and merge** and **Rebase and merge** are not offered
- Pushing directly to `main` is rejected

---

## Troubleshooting

### A required check never reports

`All Checks Passed` is the aggregate job in `.github/workflows/pr-checks.yml`.
It runs with `if: always()` and fails when any upstream job is not successful —
including **skipped** jobs, which it deliberately treats as failure. If it never
reports at all, the workflow did not trigger; check the `pull_request` branch
filter at the top of that file.

### Merge blocked with all checks green

`SonarCloud Code Analysis` is a separate integration and can lag behind the
GitHub Actions jobs. Confirm the Sonar check has actually posted, not just that
the Actions run finished.

### Adding or removing a status check

Changing job names in `pr-checks.yml` does **not** update the ruleset. After
renaming or removing a job, edit the ruleset's required-checks list to match, or
merges will block on a check that will never report.
