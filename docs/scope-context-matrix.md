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

## ADR-004

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |

2 linked fixtures with no derivable context:

- `adr-004/register-imported-bitmap-member.test.cnx`
- `adr-004/register-imported-rw.test.cnx`

## ADR-007

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-010

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | ok     | ok         | n/a         | n/a        |
| top-level function | -         | ok     | ok         | n/a         | n/a        |
| scope member       | -         | ok     | ok         | n/a         | n/a        |
| scope method       | -         | ok     | ok         | n/a         | n/a        |

11 linked fixtures with no derivable context:

- `bugs/issue-1133-guard-collision-diagnostic/guard-collision.test.cnx`
- `cpp-class-init/cpp-class-read-before-assign.test.cnx`
- `external-types/external-struct-fields.test.cnx`
- `include/cnx-alternative-error-angle.test.cnx`
- `include/cnx-alternative-error-hpp.test.cnx`
- `include/cnx-alternative-error-quoted.test.cnx`
- `include/cpp-undeclared.test.cnx`
- `include/missing-cnx-include-error.test.cnx`
- `include/self-include-public-scope.test.cnx`
- `preprocessor/include-impl-file-error.test.cnx`
- `regression/issue-332-cnx-struct-pointer.test.cnx`

## ADR-013

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |

## ADR-014

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

4 linked fixtures with no derivable context:

- `adr-014/struct-inferred-every-position.test.cnx`
- `adr-014/struct-literal-argument-transpile.test.cnx`
- `adr-014/struct-literal-for-header.test.cnx`
- `adr-014/struct-literal-positions.test.cnx`

## ADR-016

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |

3 linked fixtures with no derivable context:

- `bugs/issue-1306-nested-scope-diagnostic/cross-file-nested.test.cnx`
- `bugs/issue-1334-scope-declaration-sites/conflict-across-files.test.cnx`
- `scope/nested-scope-error.test.cnx`

## ADR-017

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |

## ADR-022

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-023

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | warn      | -      | -          | n/a         | n/a        |

## ADR-024

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-025

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-026

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-029

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |

10 linked fixtures with no derivable context:

- `adr-029/callback-assign.test.cnx`
- `adr-029/callback-basic.test.cnx`
- `adr-029/callback-multi-param.test.cnx`
- `adr-029/callback-param-types.test.cnx`
- `adr-029/callback-param.test.cnx`
- `adr-029/callback-return-types.test.cnx`
- `adr-029/callback-struct-member.test.cnx`
- `bugs/issue-1491-cross-file-function-as-type/cross-file-callback.test.cnx`
- `bugs/issue-1491-cross-file-function-as-type/cross-file-string-param.test.cnx`
- `bugs/issue-1491-duplicate-typedef/two-consumers.test.cnx`

## ADR-034

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | warn   | warn       | n/a         | n/a        |
| top-level function | ok        | warn   | warn       | n/a         | n/a        |
| scope member       | warn      | warn   | warn       | n/a         | n/a        |
| scope method       | ok        | warn   | warn       | n/a         | n/a        |

## ADR-035

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-036

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | -          | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-037

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | -         | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | -         | -      | -          | n/a         | n/a        |

6 linked fixtures with no derivable context:

- `adr-037/conditional-compilation.test.cnx`
- `adr-037/define-every-rejected-form-error.test.cnx`
- `adr-037/flag-define-valid.test.cnx`
- `adr-037/function-macro-error.test.cnx`
- `adr-037/nested-ifdef.test.cnx`
- `adr-037/value-define-error.test.cnx`

## ADR-044

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | warn      | warn   | warn       | n/a         | n/a        |
| top-level function | ok        | ok     | warn       | n/a         | n/a        |
| scope member       | warn      | warn   | warn       | n/a         | n/a        |
| scope method       | ok        | warn   | warn       | n/a         | n/a        |

## ADR-045

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

## ADR-049

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | -      | -          | n/a         | n/a        |
| top-level function | warn      | -      | -          | n/a         | n/a        |
| scope member       | warn      | -      | -          | n/a         | n/a        |
| scope method       | warn      | -      | -          | n/a         | n/a        |

## ADR-050

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

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
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | ok     | ok         | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |

4 linked fixtures with no derivable context:

- `adr-057/local-shadows-scope.test.cnx`
- `adr-057/scope-variable-does-not-capture-type.test.cnx`
- `adr-057/shadowing-all-levels.test.cnx`
- `bugs/issue-1472-global-qualifier-register-capture/global-vs-scoped-bitmap.test.cnx`

## ADR-058

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | ok        | ok     | ok         | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | ok        | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

1 linked fixture with no derivable context:

- `adr-058/length-property-enum-and-bitmap.test.cnx`

## ADR-068

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | -      | -          | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | -      | -          | n/a         | n/a        |

1 linked fixture with no derivable context:

- `adr-068/forever-basic.test.cnx`

## ADR-070

| Context            | same file | direct | transitive | from 1 away | thru chain |
| ------------------ | --------- | ------ | ---------- | ----------- | ---------- |
| global variable    | -         | -      | -          | n/a         | n/a        |
| top-level function | ok        | ok     | ok         | n/a         | n/a        |
| scope member       | -         | -      | -          | n/a         | n/a        |
| scope method       | ok        | ok     | ok         | n/a         | n/a        |
