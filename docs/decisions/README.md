# Architecture Decision Records — Numbering

This folder holds every C-Next Architecture Decision Record. This file governs **how ADRs are
numbered**; [`../architecture-decisions.md`](../architecture-decisions.md) is the companion
index that lists them **by status**.

> This is not the repository root `README.md`. CLAUDE.md's rule _"Sync order: Update ADR file
> FIRST, then README.md"_ refers to the root `README.md`, not this file.

## The rule

**An ADR's number band is the release it must ship in.**

Band `N` holds the work performed during `vN.x`. Cutting `v(N+1)` requires that **every** ADR
in band `N` is fully implemented. A band is therefore a commitment, not a label.

| Band  | Work performed during | Release gate                          | Allocated so far |
| ----- | --------------------- | ------------------------------------- | ---------------- |
| `0xx` | v0.x                  | All must be implemented to cut **v1** | 001–058, 060–070 |
| `1xx` | v1.x                  | All must be implemented to cut **v2** | 100–106, 111     |
| `2xx` | v2.x                  | All must be implemented to cut **v3** | none yet         |

### Choosing a band for a new ADR

Ask **"which release must this ship in?"** — not "when did I write it?" and not "what is the
next free number?". An ADR written today that is deliberately deferred until after v1 ships is
`1xx` work, even though it was filed during v0.x.

### Terminal statuses are exempt from the gate

`Rejected` and `Superseded` are terminal — such an ADR can never become "implemented", so it
never blocks a release. Every other status (`Research`, `Accepted`, `WIP`, `Implemented`) counts
toward its band's gate.

### Numbers are never reused

Gaps are intentional and permanent. `059` and `107` were never allocated; neither will be filled.
A retired number stays retired, so that an old issue or commit referencing it can never resolve
to a different decision than the one its author meant.

### Moving an ADR to a different band

When an ADR's target release changes, its number changes with it:

1. `git mv` the file to its new number, keeping the file stem.
2. Update **every** reference in the repository — docs, `src/`, `grammar/`, and `.test.cnx`
   fixture comments.
3. Regenerate test snapshots. ADR references inside `.test.cnx` comments are carried into
   generated `.c`/`.cpp` output by ADR-043 comment preservation, so `npm run test:update` is
   required and its diff must contain comment lines only.
4. Add a row to the renumbering history below.

Precedent: commit `a2277b87` (2026-01-07) moved ADR-051 → ADR-104 and ADR-046 → ADR-105 this way.

## Writing a new ADR

Start from [`TEMPLATE.md`](TEMPLATE.md). Copy it to `adr-NNN-short-stem.md`,
pick the band per the rule above, and fill in the sections — the guidance
comments explain what each one is for and delete as you go.

`Context`, `Decision`, and `References` appear in nearly every existing ADR and
the template treats them as required. Two sections are easy to skip and
expensive to skip:

- **Diagnostics** — every error code the ADR introduces, allocated in
  `docs/error-codes.md` in the same change. A code reserved and never allocated
  reads as implemented when it is not.
- **Scope-Context Matrix (#1219)** — required for any ADR whose behaviour a
  fixture can observe. Undeclared cells default to `off`, so an ADR without a
  matrix is indistinguishable from one claiming its feature cannot occur
  anywhere, and nothing in the gate will tell you. `off` is a claim that a cell
  **cannot exist**, and it is reviewed as one.

The template carries the tooling limits and the two dimensions the axes cannot
see. [ADR-051](adr-051-division-by-zero.md) section 5 is the worked example,
including how it staged `warn` → `error` while a cell was known broken;
[ADR-070](adr-070-return-value-use.md) is the example of arguing rows to `off`
from the grammar.

## Renumbering history

GitHub issues and merged pull requests permanently reference the numbers that were current when
they were written. This table is how those references stay resolvable.

| Old     | New     | Title                       | When       | Why                                          |
| ------- | ------- | --------------------------- | ---------- | -------------------------------------------- |
| ADR-046 | ADR-105 | Prefixed Includes           | 2026-01-07 | Deferred to the v2 roadmap                   |
| ADR-051 | ADR-104 | ISR-Safe Queues             | 2026-01-07 | Deferred to the v2 roadmap                   |
| ADR-108 | ADR-064 | Volatile Keyword            | 2026-08-23 | v0 work mis-filed in the `1xx` band          |
| ADR-109 | ADR-065 | CodeGenerator Decomposition | 2026-08-23 | v0 work mis-filed in the `1xx` band          |
| ADR-110 | ADR-066 | DO-178C Compliance          | 2026-08-23 | Required for v1; mis-filed in the `1xx` band |
| ADR-112 | ADR-067 | All-Paths-Return            | 2026-08-23 | v0 work mis-filed in the `1xx` band          |
| ADR-113 | ADR-068 | Forever Loops               | 2026-08-23 | v0 work mis-filed in the `1xx` band          |
| ADR-114 | ADR-069 | Dead-Code / Reachability    | 2026-08-23 | Required for v1; mis-filed in the `1xx` band |
| ADR-115 | ADR-070 | Return-Value Use            | 2026-08-23 | Required for v1; mis-filed in the `1xx` band |

A changed file stem is not a renumbering and does not belong in this table. ADR-022 was
rewritten in place in commit `1f56e2d8` (`adr-022-ternary-operator.md` was replaced by
`adr-022-conditional-expressions.md`), but it kept its number, so nothing needed to be
remapped.

### Why the 2026-08-23 corrections were needed

ADRs 100–106 were created on 2026-01-04 as a deliberate v2 bucket, and `a2277b87` moved two more
ADRs into that bucket three days later. But the convention lived only in those commit messages,
so every ADR filed afterward (108, 109, 110, 112, 113, 114, 115) simply continued the integer
sequence and landed in the wrong band. Writing the rule down here — and in CLAUDE.md — is what
stops that from recurring.
