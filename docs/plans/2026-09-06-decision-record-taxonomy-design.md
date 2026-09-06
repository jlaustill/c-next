# Decision-Record Taxonomy Design

**Date:** 2026-09-06
**Issue:** [#1522](https://github.com/jlaustill/c-next/issues/1522)
**Status:** Approved

## Summary

Split `docs/decisions/` into two decision-record series with distinct prefixes — `ADR-NNN`
for C-Next language decisions in `docs/cnx-spec-adrs/`, `PDR-NNN` for project and toolchain
decisions in `docs/project-decisions/` — and gate the split so a description cannot silently
become a decision record. Generate the by-status index from the record files instead of
maintaining it by hand.

## Goals

1. Give a non-language decision a home, so it is not exiled into a folder meant for descriptions
2. Make the category of a document observable and gated, not conventional
3. Remove the hand-maintained index as a drift source
4. Settle ADR-010's category, so the C/C++ interop matrix has a stable file to declare against

## Non-Goals

- The C/C++ interop testing matrix itself. Tracked separately; this work only unblocks it.
- Renumbering any ADR. Numbers do not move, so no `.test.cnx` fixture comment changes and no
  snapshot regeneration.
- Changing the rewrite test or any of its rules. All 70 ADRs pass it today and must continue to.

## Context

### The gap

The rewrite test (#1403) admits only decisions about the C-Next language:

> If the transpiler were rebuilt from scratch in a different language and stack, every ADR must
> still be fully applicable.

That is the right test, and `npm run adr:independence:check` enforces it — measured
2026-09-06, it reports "Scanned 70 ADR(s) ... Rewrite test passed for every ADR." But the test
says only what an ADR may _not_ contain. It does not say where a genuine decision that fails it
should live. #1403 answered by moving six retired ADRs into `docs/architecture/` and
`docs/implementation/`, and the outcome splits cleanly along a line nobody drew on purpose:

| Retired | Moved to                                      | Kept a `**Status:**` line |
| ------- | --------------------------------------------- | ------------------------- |
| `011`   | `docs/implementation/vscode-extension.md`     | yes — `Implemented`       |
| `012`   | `docs/implementation/static-analysis.md`      | yes — `Implemented`       |
| `048`   | `docs/implementation/cli-distribution.md`     | yes — `Implemented`       |
| `060`   | `docs/implementation/extension-separation.md` | yes — `Research`          |
| `055`   | `docs/architecture/symbol-resolution.md`      | no                        |
| `065`   | `docs/architecture/codegen-decomposition.md`  | no                        |

The bottom two genuinely became descriptions and shed their lifecycle. The top four are still
decision records — `extension-separation.md` sits at **Research**, an ADR lifecycle state, in a
folder whose stated purpose is documenting work already carried out. They were moved for want
of anywhere better.

### Two bugs this surfaces

Both are fixed by this work rather than filed, per the project's bug-tracking rule.

1. **A stale status nothing can detect.** `docs/implementation/adr-045-string-implementation.md`
   reads `**Status:** Ready for Implementation`; `ADR-045` itself reads `**Status:** Implemented`.
   A description grew a lifecycle field, and the two now contradict each other with nothing
   failing in between.
2. **The index has already drifted.** `docs/architecture-decisions.md` lists 68 ADRs; 70 exist
   on disk. **ADR-061 (C Library Interoperability)** and **ADR-062** are absent. Its ADR-010 row
   also describes the decision as "Unified ANTLR parser architecture", which the split below
   makes wrong. The file is hand-maintained, so adding a record and adding a row are two actions
   and only one of them is enforced — the "update it in two places" anti-pattern, expressed in
   Markdown.

### Two status formats

Every ADR carries a status, but in one of two incompatible shapes (measured 2026-09-06):

| Shape                                                              | Count  | Example                   |
| ------------------------------------------------------------------ | ------ | ------------------------- |
| Header block — `**Status:** Implemented` (what `TEMPLATE.md` uses) | **37** | ADR-010, ADR-016          |
| Section — `## Status` followed by `**Implemented**`                | **33** | ADR-017, ADR-051, ADR-061 |
| Neither                                                            | 0      | —                         |

Any tool that reads a status must therefore handle both shapes forever, or silently miss a third
of the corpus. That is the same "one fact, two representations" anti-pattern the project forbids
in code, expressed in Markdown. The migration normalizes all 70 records to the template form and
the gate enforces that exactly one shape exists.

## Decision

### Four tenants

| Directory                 | Holds                                            | Identity  | Rewrite test | Release bands            | Matrix obligations |
| ------------------------- | ------------------------------------------------ | --------- | ------------ | ------------------------ | ------------------ |
| `docs/cnx-spec-adrs/`     | decisions about the **C-Next language**          | `ADR-NNN` | yes          | yes (`0xx`→v1, `1xx`→v2) | yes                |
| `docs/project-decisions/` | decisions about the **project/toolchain**        | `PDR-NNN` | no           | yes (same bands as ADRs) | no                 |
| `docs/architecture/`      | descriptions of how the transpiler is structured | path      | no           | n/a                      | no                 |
| `docs/implementation/`    | descriptions of how one decision is carried out  | path      | no           | n/a                      | no                 |

Rows 1–2 are decision records and have a lifecycle. Rows 3–4 are descriptions and do not. The
observable marker of that difference is the `**Status:**` line.

### Numbering: one space, one band semantics, two prefixes

**A number is allocated once, ever, to one decision. The prefix says which series holds it. The
band says which release it must ship in.** Both series draw from the same ledger, so `011` names
exactly one decision whether it is written `ADR-011` or `PDR-011`.

This is a strengthening of the existing guarantee, not a change to it.
`docs/decisions/README.md` promises that a number "can never resolve to a different decision than
the one its author meant" — and `PDR-011` _is_ `ADR-011`, the same decision relocated to a series
that fits it. A migrated record therefore **keeps its number and changes only its prefix**, so a
reference in an old commit resolves to a record still bearing the number its author wrote, rather
than to a table row pointing somewhere else.

A new PDR takes the next free number in the shared ledger and picks its band by the same question
an ADR asks: _which release must this ship in?_ The mechanism half of ADR-010 is therefore
`PDR-071` — the next free `0xx` number, band `0xx`, Status Implemented.

**PDRs are band-gated on the same terms as ADRs.** Cutting `v(N+1)` requires every non-terminal
record in band `N` to be Implemented, in **both** series. A release needs its toolchain and
distribution story as much as its language surface, so a project decision that v1 depends on
should block v1 — the release gate becomes more honest, not merely broader.

The practical cost is one new v1 blocker. Verified 2026-09-06: `vscode-extension`,
`static-analysis` and `cli-distribution` are all `Implemented`, but `extension-separation`
(`PDR-060`) is `Research`, so it must be implemented, moved to band `1xx` by the documented
`git mv` procedure, or marked terminal before v1 is cut.

Because bands apply to both series identically, no reserved number range is needed and no
grandfathered exception set exists: `PDR-071` in band `0xx` means exactly what it appears to
mean.

### Initial PDR population

| New       | From                                                        | Band  | Status                      |
| --------- | ----------------------------------------------------------- | ----- | --------------------------- |
| `PDR-011` | `docs/implementation/vscode-extension.md` (was ADR-011)     | `0xx` | Implemented                 |
| `PDR-012` | `docs/implementation/static-analysis.md` (was ADR-012)      | `0xx` | Implemented                 |
| `PDR-048` | `docs/implementation/cli-distribution.md` (was ADR-048)     | `0xx` | Implemented                 |
| `PDR-060` | `docs/implementation/extension-separation.md` (was ADR-060) | `0xx` | **Research — a v1 blocker** |
| `PDR-071` | new — the mechanism half of ADR-010                         | `0xx` | Implemented                 |

The numbering README's retirement table splits into three genuinely different fates, which it
currently conflates into one:

| Number                  | Fate                                             | Resolves to                                |
| ----------------------- | ------------------------------------------------ | ------------------------------------------ |
| `011` `012` `048` `060` | **recategorized** — same decision, new series    | `PDR-011`, `PDR-012`, `PDR-048`, `PDR-060` |
| `055` `065`             | became descriptions — no longer decision records | `docs/architecture/…`                      |
| `053`                   | withdrawn                                        | nothing; permanently retired               |
| `059` `107`             | never allocated                                  | nothing; never will be                     |

`055` and `065` are not touched: they correctly became descriptions and their numbers stay
retired.

### ADR-010 splits

ADR-010 currently carries a language promise and a parser-architecture decision in one file. It
passes the independence gate — which catches `src/**` paths and transpiler identifiers, not "we
chose ANTLR" — but its title is "C/C++ Interoperability **via Unified ANTLR Parsing**" and its
Decision section is a component diagram.

**ADR-010 keeps** (the promise a rebuild in another stack still owes):

- No declaration files, no extern blocks, no special syntax
- `.c` / `.h` / `.cpp` / `.hpp` are consumed as-is
- What the emitted `#include` names
- The limits of the boundary — what C-Next promises to understand from a C/C++ header
- A `MATRIX-SEVERITY` table, once the interop matrix exists

**PDR-071 takes** (the mechanism):

- Why vendored ANTLR grammars over libclang, a hand-written parser, or declaration files
- C and CPP14 grammar caveats, preprocessor handling
- Implementation phases and status

The number `010` does not move, so every existing reference resolves unchanged.

The boundary-limits section is the load-bearing part of this split. Read as spec it states what
C-Next promises to understand at the boundary; read as implementation it states which grammar
was vendored. The interop matrix will derive its `off` cells from the first reading, so this
section must live where it is reviewed as a language promise.

### Sweep

Only three ADRs carry mechanism-shaped `Implementation Phases` / `Implementation Status`
sections: **010, 016, 051**. The 21 ADRs that mention a toolchain are almost all ` ```antlr `
grammar fences, which the in/out list explicitly permits, plus ADR-070 citing cppcheck's
interpretation of a MISRA rule, which is evidence about the rule rather than implementation
detail. 016 and 051 are reviewed in this work; neither is expected to need a split.

## The gate

`adr:independence:check` becomes `docs:taxonomy:check` — **one** scanner with per-directory
rulesets. A second scanner would duplicate the directory walk, the front-matter read and the
violation reporting that `AdrIndependence` (312 lines) already performs, and the two would
diverge the first time a rule changed.

| Directory                          | Must have                       | Must not have                              |
| ---------------------------------- | ------------------------------- | ------------------------------------------ |
| `cnx-spec-adrs/`                   | `adr-NNN-*.md`, Status, Summary | _(existing rewrite-test rules, unchanged)_ |
| `project-decisions/`               | `pdr-NNN-*.md`, Status, Summary | a `MATRIX-SEVERITY` table                  |
| `architecture/`, `implementation/` | —                               | a status declaration, in **either** shape  |

Plus three mechanical invariants: exactly one status shape exists corpus-wide, no number is used
twice within a series, and the numbering README's allocation table matches what is on disk.

**Only the two fields tooling consumes are required.** `## Context`, `## Decision` and a
rejected-alternatives section are deliberately NOT gated: 15 ADRs express their decision under
another heading (ADR-016 uses `## Proposal:`, ADR-004 uses `## Research:`) and 2 of the 4 PDR
candidates have no alternatives section. Requiring them would mean editing prose to satisfy a
linter, which is the gate driving the content rather than measuring it. The rewrite test and
human review keep covering section quality.

The status rule is the load-bearing one. It is the only invariant here that fails on the case it
exists to catch: filename patterns and collision checks would never have flagged the four
mis-filed ADRs, because those files had perfectly good names. `adr-045-string-implementation.md`
proves the rule fires on real content today.

It must reject **both** shapes in a description, not only the template form. Normalizing decision
records to one shape does not stop a description from acquiring the other, so a check that knew
only `**Status:**` would have a hole exactly where someone would naturally write one.

Runs in the **`lint`** job, where the current independence check runs. It is not added to
`test:all`, which must stay update-free to remain a gate.

## The generated index

`docs/architecture-decisions.md` becomes generated and gated, following the
`scope-context-matrix.md` and `diagnostic-manifest.md` pattern: `npm run docs:adr-index` writes,
`docs:adr-index:check` regenerates in memory and diffs against what is committed. Output is
grouped by Status with ADRs and PDRs in separate sections, and carries the
`<!-- GENERATED FILE - DO NOT EDIT -->` header and no timestamp. Because migration step 1
normalizes the corpus, the generator reads exactly one status shape — it is deliberately not
given a both-shapes parser, which would let the duplicate representation survive behind it.

Its Description column needs a source. ADRs have none — only 1 of 70 carries a `**Summary:**`
field — while the 68 descriptions that exist live in the index itself, away from the records they
describe. That separation _is_ the drift: nothing ties ADR-010's row to ADR-010, which is why the
row still describes a decision the file no longer makes. The fix is a one-time transfer, not an
authoring job: lift each description into a required `**Summary:**` field on its own record,
author two for ADR-061 and ADR-062, and add the field to both templates.

## Migration

Ordered so each step is independently reviewable.

1. **Normalize status and backfill `**Summary:**`** across all 70 ADRs: move the 33
   section-style statuses into the template's header block, and lift each record's description
   out of the index into a `**Summary:**` field. Author the two missing descriptions (ADR-061,
   ADR-062) and add the field to `TEMPLATE.md`. No moves, so every diff is confined to a file's
   header.
2. **`git mv docs/decisions docs/cnx-spec-adrs`.** Pure rename.
3. **Create `docs/project-decisions/`** with its README and TEMPLATE; move the four #1403
   retirees in as PDR-011, PDR-012, PDR-048 and PDR-060, each keeping its original number;
   replace the numbering README's single retirement table with the three-fate table above.
4. **Split ADR-010** into ADR-010 + PDR-071. Fix the `adr-045-string-implementation.md` status
   contradiction. Review 016 and 051.
5. **Generate the index** (`docs:adr-index` / `:check`), covering both series.
6. **Extend the gate** to `docs:taxonomy:check` with the per-directory rulesets.

Step 1 precedes step 2 deliberately. Combining them would render every file as "moved +
modified", burying 70 one-line additions inside a 32-file path substitution. Keeping them apart
lets `git mv` rename-detection stay clean, so step 2's diff reads as a pure rename — the only way
a reviewer can confirm no content changed during the move.

### Rename blast radius (measured 2026-09-06)

| What                                      | Count | Notes                                                                                                           |
| ----------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Textual `docs/decisions` occurrences      | 47    | across 32 files                                                                                                 |
| Hardcoded path constants                  | 3     | `adr-matrix.ts:28`, `AdrIndependence.ts:288`, `adr-independence.test.ts:215`                                    |
| Doc-comment mentions in code              | 5     | `adr-independence.ts:37`, `AdrIndependence.ts:13,280`, `IAdrIndependenceOutcome.ts:4`, `cspell-scope.test.ts:5` |
| Config and skills                         | 3     | `.github/ISSUE_TEMPLATE/release.md:28`, `cnext-way/SKILL.md:76`, `start-issue/SKILL.md:293`                     |
| Relative sibling links inside the folder  | 56    | unaffected by a folder rename                                                                                   |
| `.test.cnx` fixtures referencing the path | **0** | 461 reference ADR _numbers_, which do not move                                                                  |

Because no fixture references the path and no number changes, `npm run test:update` is **not**
required and no snapshot may change. A snapshot diff during this work indicates a mistake.

## Testing

Each gate gets a mutation check, because a gate that cannot fail on its own case is the
`/* test-no-warnings */` shape (#1143).

| Gate rule                              | Mutation                                              | Expected                                         |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| No status in descriptions              | add `**Status:** Research` to an `architecture/` file | `docs:taxonomy:check` red                        |
| No status in descriptions, other shape | add a `## Status` section to an `architecture/` file  | red — the hole a template-only check would leave |
| One status shape                       | revert one ADR to the `## Status` section form        | red                                              |
| PDRs own no matrix                     | add a `MATRIX-SEVERITY` table to a PDR                | red                                              |
| One ledger, no collisions              | give a PDR a number an ADR already holds              | red                                              |
| No duplicate numbers                   | duplicate a number within one series                  | red                                              |
| Filename pattern                       | add `notes.md` to `project-decisions/`                | red                                              |
| Index is current                       | delete a row from the generated index                 | `docs:adr-index:check` red                       |
| Rewrite test unchanged                 | add a `src/**` path to an ADR                         | red, as today                                    |

Restore and re-run after each; assert the mutation is gone before moving on, since a scripted
replacement can silently match nothing and report the same green as a guard that cannot fail.

Unit tests live in `scripts/__tests__/`, alongside the existing `adr-independence.test.ts`.

## Documentation

- `docs/cnx-spec-adrs/README.md` — the shared numbering ledger, bands, the rewrite test and its
  in/out list (unchanged content, new path), the three-fate retirement table, and a pointer to
  the PDR series for decisions that fail the rewrite test
- `docs/project-decisions/README.md` — what belongs here, that a PDR owns no matrix obligation,
  and that numbering and bands are the shared rules defined once in the ADR README, not restated
- `docs/project-decisions/TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/release.md` — §2's band gate must count every non-terminal record in
  **both** series, not ADRs alone; its checklist item and its link both need updating. Without
  this the band decision is stated in the READMEs and enforced by nothing at release time.
- `CLAUDE.md`, `CONTRIBUTING.md`, `AGENTS.md`, root `README.md` — path updates; the in/out list
  stays in one home and is not copied
- `.claude/skills/cnext-way/SKILL.md`, `.claude/skills/start-issue/SKILL.md` — path updates

## Follow-up

The C/C++ interop testing matrix is the sibling project this unblocks. The scope-context matrix
measures only `.cnx` include hops — `IncludeDepth.resolveCnxInclude` returns null for any path
not ending `.cnx` — so all 168 fixtures that include a C or C++ header measure as `same-file`,
including the two tagged ones. No interop ADR declares a single obligation today. That work
declares `MATRIX-SEVERITY` rows on ADR-010, 046, 047 and 061, which is why ADR-010's category
had to be settled first.
