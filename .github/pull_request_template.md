## Summary

<!-- 1-3 sentences describing what this PR does -->

## Changes

- Added/Modified: <!-- File --> - <!-- What changed -->
- Added: <!-- Test files --> - <!-- What they test -->
- Updated: <!-- Docs --> - <!-- What was updated -->

## Pre-Submit Checklist

**Code Quality** (Auto-checked by pre-commit hooks if you ran `npm install`)

- [ ] Code is properly formatted (`npm run prettier:fix` or rely on pre-commit hook)
- [ ] No ESLint errors in modified files (`npm run eslint:check`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] All tests pass (`npm test`)

**Documentation**

- [ ] README.md updated (if feature-visible)
- [ ] ADR updated with implementation details (if applicable)
- [ ] `learn-cnext-in-y-minutes.md` updated (if syntax changed)
- [ ] Test README created in `tests/[feature]/README.md`

**Git Hygiene**

- [ ] Only related files included (no unrelated changes)
- [ ] No debug code left in source
- [ ] Commit messages are descriptive

## Testing

- [ ] All existing tests pass
- [ ] New tests added: **N** tests in `tests/[feature]/`
- [ ] `.expected.c` files created for passing tests

## Related Issues

<!-- Use keywords: Closes #NNN, Fixes #NNN, Related to ADR-NNN -->

---

**Note:** If CI fails with prettier/eslint errors:

1. Run `npm run prettier:fix && npm run eslint:fix`
2. Commit and push the fixes
3. Ensure you ran `npm install` to set up pre-commit hooks for future commits
