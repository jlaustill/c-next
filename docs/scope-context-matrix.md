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
| global variable    | warn      | warn   | warn       | n/a         | n/a        |
| top-level function | ok        | warn   | warn       | n/a         | n/a        |
| scope member       | warn      | warn   | warn       | n/a         | n/a        |
| scope method       | warn      | warn   | warn       | n/a         | n/a        |
