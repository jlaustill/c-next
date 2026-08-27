<!-- GENERATED FILE - DO NOT EDIT.
     Source: the fixture corpus under tests/ plus each ADR's MATRIX-SEVERITY table.
     Regenerate: npm run coverage:matrix -->

# Scope-Context Test Matrix

Which structural contexts and file relationships each ADR's fixtures actually
exercise. Occupancy is derived from the fixture corpus; the obligation for each
cell is declared by the ADR that owns it.

| Legend        | Meaning                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `ok`          | a fixture occupies this cell                                                    |
| `**MISSING**` | the ADR declared `error` and nothing occupies it                                |
| `warn`        | the ADR declared `warn` and nothing occupies it                                 |
| `-`           | no obligation declared (`off`)                                                  |
| `n/a`         | not derivable yet -- provider-side relationships need the emitting file (#1219) |

## ADR-051

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |

## ADR-057

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | warn      | warn   | warn       | n/a         | n/a        |
| top-level function | warn      | warn   | warn       | n/a         | n/a        |
| scope member       | warn      | warn   | warn       | n/a         | n/a        |
| scope method       | ok        | warn   | warn       | n/a         | n/a        |

10 linked fixtures with no derivable context:

- `bugs/issue-1210-bare-intra-scope-call/bare-intra-scope-call.test.cnx`
- `bugs/issue-1244-adr057-scope-member-shadow/scope-member-shadow.test.cnx`
- `scope-resolution/bare-array-member.test.cnx`
- `scope-resolution/bare-function-call.test.cnx`
- `scope-resolution/bare-scope-member.test.cnx`
- `scope-resolution/cross-scope-access.test.cnx`
- `scope-resolution/edge-cases/global-var-same-as-scope.test.cnx`
- `scope-resolution/local-shadows-scope.test.cnx`
- `scope-resolution/shadowing-all-levels.test.cnx`
- `scope/issue-1130-scope-type-qualification.test.cnx`

## ADR-070

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
