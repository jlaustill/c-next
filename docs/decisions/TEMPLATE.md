# ADR-NNN: Title

> Copy this file to `adr-NNN-short-stem.md` and delete every `<!-- guidance -->`
> comment as you fill it in. The band `NNN` sits in is a commitment about which
> release the decision must ship in — see [`README.md`](README.md) before
> choosing a number.

**Status:** Research
**Date:** YYYY-MM-DD
**Decision Makers:**
**Related ADRs:**
**Related Issues:**

<!-- Status is one of Research / Accepted / WIP / Implemented / Rejected /
     Superseded. It starts at Research and only the owner moves it. Nobody
     else changes this line, in any circumstance. -->

## Context

<!-- What is true today that makes this worth deciding, and what goes wrong if
     nothing changes. Show the current behavior rather than describing it —
     a transpiled snippet is worth a paragraph. If a rule is being added, this
     is where the bug it prevents belongs. -->

## Decision

<!-- What C-Next does, stated so an implementer needs nothing else. Say what is
     REJECTED as well as what is chosen: an ADR that lists only the choice
     leaves the next reader re-litigating the alternatives.

     If the decision changes what compiles, say so plainly here. -->

## Diagnostics

<!-- Every error code this ADR introduces, with the exact message and the module
     that raises it. Allocate the code in `docs/error-codes.md` in the same
     change; a code reserved and never allocated reads as implemented when it is
     not. Omit this section only if the ADR adds no diagnostic. -->

| Code | Meaning | Raised by |
| ---- | ------- | --------- |

## Scope-Context Matrix (#1219)

<!-- REQUIRED for any ADR whose behavior a fixture can observe. Do not skip it
     because the gate does not force you: undeclared cells default to `off`, so
     skipping is indistinguishable from claiming the feature cannot occur
     anywhere, and that claim is almost never true.

     Severity follows the eslint model:
       off   — this cell CANNOT EXIST for this feature
       warn  — it should be covered and is not, yet
       error — it must be covered

     `off` is the one that gets people into trouble. It is a claim about the
     grammar or the semantics, and it is reviewed as one. Before writing `off`,
     try to WRITE the program that would occupy the cell. If it is a parse
     error, say so and quote it. If it merely has no fixture, the cell is
     `error` or `warn` — never `off`.

     Never declare a cell because a fixture happens to occupy it. Declare the
     obligation the feature has, then run `npm run coverage:matrix` and let the
     tool report occupancy. Working backwards from the corpus produces a matrix
     that measures what you already wrote.

     Where a cell should be `error` and nothing reaches it, write the fixture.
     Where writing it is a project rather than an afternoon, declare `warn`,
     say plainly here why, and file the follow-up. ADR-051 held eight cells at
     `warn` while the transpiler defect behind them was open, and promoted them
     when it was fixed — that staging is legitimate and documented. Declaring
     `off` because `error` would be red is not.

     Mark each fixture with `// test-adr: NNN`. -->

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           |          |
| top-level function | same file           |          |
| scope member       | same file           |          |
| scope method       | same file           |          |
| global variable    | imported direct     |          |
| top-level function | imported direct     |          |
| scope member       | imported direct     |          |
| scope method       | imported direct     |          |
| global variable    | imported transitive |          |
| top-level function | imported transitive |          |
| scope member       | imported transitive |          |
| scope method       | imported transitive |          |

<!-- Two tooling limits apply to every matrix, both tracked as #1241:

     1. Only a fixture with an `.expected.error` can occupy a cell, because
        context is derived from the diagnostic's position. An ADR governing
        codegen shape rather than a diagnostic cannot satisfy an `error` cell
        yet — declare `warn` and reference #1241 rather than pretending.

     2. The relationship axis measures the DEEPEST include chain reachable from
        the fixture, not the hops to the declaration under test. So a helper
        that gains an unrelated include silently moves the cells its consumers
        occupy. When you need a transitive fixture, build it a NEW chain rather
        than adding an include to a helper other fixtures already use.

     Two things the axes cannot see at all, worth knowing before you trust a
     green row:

     - SYNTACTIC FORM. A bare `read()` and a qualified `this.read()` inside the
       same scope method derive the same cell. A rule enforced on one spelling
       and not the other shows green. This has happened twice (#1210, #1260).
     - EXTERNAL-HEADER PROVENANCE. The relationship axis counts `.cnx` hops
       only, so a symbol from a `.h` or a `.hpp` is indistinguishable from a
       same-file one — and those are two separate symbol indexes.

     If your feature can be written more than one way, or resolves symbols from
     C or C++ headers, write fixtures for those forms anyway. They will not
     occupy distinct cells, but they will fail when someone breaks one spelling.

     Worked example: ADR-051 section 5, including how it staged warn -> error.
     Second example: ADR-070, including how it argues two rows to `off`. -->

## Consequences

<!-- What this costs. Breaking changes, migration size (measured, not
     estimated), interactions with other ADRs, and anything it forecloses. -->

## Open Questions

<!-- Genuinely undecided things. Move them into the Decision as they settle,
     and say who settled them. An Open Question still open when the ADR reaches
     Implemented is a contradiction worth catching in review. -->

## References

<!-- Issues, standards clauses, prior art, and the implementing modules. Cite
     `file:line` or a command, not recollection. -->
