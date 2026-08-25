---
name: Release
about: Track a release as ordinary work, from version bump to published tag
title: "Release vX.Y.Z"
labels: "priority: high"
assignees: jlaustill
---

A release is work, so it gets managed as work. This issue is the unit of that
work: it moves Backlog → WIP → Done like anything else. Set the milestone to the
version being released — the milestone identifies _which_ release, so "Release"
never needs to be a board status.

Full detail for each step lives in [`releasing.md`](../../releasing.md).

## 1. Documentation sync

- [ ] `CHANGELOG.md` has an entry for this version with its date, and
      `[Unreleased]` is emptied into it
- [ ] ADR statuses are correct (Accepted → Implemented where code is complete)
- [ ] `README.md` ADR table matches the ADR file statuses
- [ ] `docs/learn-cnext-in-y-minutes.md` reflects any syntax change

## 2. Release band gate

An ADR's number band is the release it must ship in: cutting `v(N+1)` requires
every non-terminal ADR in band `N` to be Implemented. `Rejected` and
`Superseded` are exempt. See [`docs/decisions/README.md`](../../docs/decisions/README.md).

- [ ] For a major release only: every non-terminal ADR in the outgoing band is
      Implemented (or explicitly moved to another band, which is a `git mv` plus updating
      every reference and `npm run test:update`)

## 3. VS Code extension (only if the grammar changed)

- [ ] `tmLanguage.json` synced in [vscode-c-next](https://github.com/jlaustill/vscode-c-next)
- [ ] `completionProvider.ts` keywords synced
- [ ] Extension version tagged so the marketplace picks it up

## 4. Version bump

- [ ] `package.json` version bumped
- [ ] `npm install` run so `package-lock.json` follows

## 5. Verification

- [ ] `npm run test:all` passes
- [ ] `npm run analyze` — transpiled output compiles clean
- [ ] `npm run typecheck` — no TypeScript errors

## 6. Ship

- [ ] Release branch merged to `main` via a merge commit (never squash)
- [ ] Tag pushed (`git tag vX.Y.Z && git push origin vX.Y.Z`) — this is what
      triggers `publish.yml`
- [ ] npm shows the new version (`npm view c-next versions`)
- [ ] GitHub release created with the right tag
- [ ] `npm install -g c-next@latest && cnext --version` reports the new version
