# Branch Protection Setup Guide

This guide shows how to configure GitHub branch protection rules to enforce the PR workflow and require CI checks to pass before merging.

---

## Overview

Branch protection will:

- ✅ Require all tests to pass before merge
- ✅ Require code review approval
- ✅ Prevent direct pushes to `main`
- ✅ Require branches to be up-to-date before merge

---

## Setup Steps

### 1. Navigate to Branch Protection Settings

1. Go to your GitHub repository
2. Click **Settings** (top navigation)
3. Click **Branches** (left sidebar)
4. Under "Branch protection rules", click **Add rule**

### 2. Configure Protection Rule

**Branch name pattern:**

```
main
```

**Enable these settings:**

#### Require a pull request before merging

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1** (or more, depending on team size)
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners _(optional - if you have CODEOWNERS file)_

#### Require status checks to pass before merging

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - **Search for and select these status checks:**
    - `Code Quality & Tests` _(from pr-checks.yml workflow)_
    - `All Checks Passed` _(summary job)_

  > **Note:** These checks will appear in the list after the workflow runs at least once. Push a test PR or push to main first to populate them.

#### Other settings

- [x] **Require conversation resolution before merging** _(optional but recommended)_
- [ ] **Require signed commits** _(optional - if your team uses GPG signing)_
- [ ] **Require linear history** _(optional - enforces squash merging)_
- [x] **Do not allow bypassing the above settings** _(recommended - applies to admins too)_
- [ ] **Allow force pushes** _(leave unchecked)_
- [ ] **Allow deletions** _(leave unchecked)_

### 3. Save Protection Rule

Click **Create** or **Save changes** at the bottom.

---

## Testing the Setup

### Step 1: Create a test PR

```bash
git checkout -b test/branch-protection
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "Test branch protection"
git push origin test/branch-protection
```

### Step 2: Open PR on GitHub

1. Go to your repository
2. Click **Pull requests** → **New pull request**
3. Select `test/branch-protection` as source
4. Create the PR

### Step 3: Verify Protections

You should see:

- ✅ **Status checks running** (Code Quality & Tests)
- ⚠️ **Merge button disabled** until checks pass
- ⚠️ **"Review required"** message (if review requirement enabled)

### Step 4: After checks pass

- ✅ Status checks turn green
- ✅ Merge button becomes enabled (if reviewed)
- ✅ You can merge the PR

### Step 5: Clean up test

```bash
git checkout main
git pull origin main
git branch -d test/branch-protection
git push origin --delete test/branch-protection
```

---

## Workflow Status Badge (Optional)

Add a status badge to your README.md to show CI status:

```markdown
[![CI](https://github.com/YOUR_USERNAME/c-next/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/YOUR_USERNAME/c-next/actions/workflows/pr-checks.yml)
```

Replace `YOUR_USERNAME` with your GitHub username or organization name.

---

## Troubleshooting

### Status checks don't appear in the list

**Problem:** The workflow must run at least once before checks appear.

**Solution:**

```bash
# Push directly to main (before protection is enabled)
git checkout main
git commit --allow-empty -m "Trigger CI workflow"
git push origin main

# Wait for workflow to complete, then add protection rule
```

### "This branch is out-of-date"

**Problem:** Someone else merged to main while you were working.

**Solution:**

```bash
git checkout your-branch
git fetch origin
git rebase origin/main
git push --force-with-lease
```

### Merge blocked even though checks passed

**Possible causes:**

1. Review approval not received yet
2. Conversations not resolved
3. Branch not up-to-date with main

**Solution:** Check PR page for specific blocker and address it.

---

## Best Practices

### For Repository Admins

1. **Don't bypass protections** - Follow the same PR process as everyone else
2. **Review branch protection** - Periodically check settings haven't been changed
3. **Monitor workflow costs** - GitHub Actions are free for public repos, have limits for private

### For Contributors

1. **Keep PRs small** - Easier to review, faster to merge
2. **Rebase regularly** - Stay up-to-date with main to avoid conflicts
3. **Fix CI failures quickly** - Don't let broken tests sit
4. **Respond to reviews** - Keep the process moving

---

## Workflow Maintenance

### Adding New Status Checks

If you add new jobs to `.github/workflows/pr-checks.yml`:

1. Let the workflow run once with new jobs
2. Go to Settings → Branches → Edit protection rule for `main`
3. Search for and add the new status check name
4. Save the rule

### Removing Status Checks

If you remove jobs from the workflow:

1. Go to Settings → Branches → Edit protection rule for `main`
2. Find the removed check and click the ❌ to remove it
3. Save the rule

---

## Reference Links

- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Required Status Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

**Last Updated:** 2026-01-11
