# #1322 review — a rooted spelling must bind to what it states

`this.NAME` and `global.NAME` state where to look. Four analyzers each decided
that separately and disagreed: two gave `global.` its own arm and let `this.`
fall through to a lexical search, and two dropped both roots. Nothing in the
corpus wrote a local that **shadows** what a rooted spelling refers to, so every
disagreement was invisible — each rule looked correct in the file that
exercised it.

One fixture per rule, because `runAnalyzers` halts at the first step that finds
anything: four assertions in one file would only ever show the earliest. Split
this way, reverting one analyzer reddens exactly one fixture.

| fixture                    | rule  | what was emitted before                                                                |
| -------------------------- | ----- | -------------------------------------------------------------------------------------- |
| `this-shadowed-bit-access` | E0856 | `Internal:` assertion at `1:0` — 2.1 claimed to have rejected a program it let through |
| `this-shadowed-const`      | E0877 | `Board__STEP = 5U;`, which gcc cannot compile                                          |
| `global-shadowed-string`   | E0857 | a `string` fed to `cnx_clamp_add_u8`                                                   |
| `global-shadowed-bounds`   | E0854 | an out-of-bounds **write** against a four-element array                                |

Each fixture puts the same rule on the same name with **no** shadow directly
above its assertion, so a rule that fired on the spelling rather than on the
declaration would fail on the control.
