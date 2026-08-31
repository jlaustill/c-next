# ADR-057: Implicit Scope Resolution

**Status:** Implemented
**Date:** 2026-01-28 (amended 2026-08-08 — type positions, #1130; amended 2026-08-27 — implementation detail removed, matrix declared, #1285)
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-016 (Scopes — this ADR amends its name-resolution decision), ADR-017 (Enums), ADR-029 (Function Pointers — a function definition also creates a type), ADR-063 (Identifier Syntax — makes the qualified name injective)
**Related Issues:** #1130, #1210, #1244, #1285
**Amends:** ADR-016 — which required explicit `this.` and `global.` and stated that implicit resolution does not exist. That requirement is withdrawn by this ADR.

## Context

C-Next originally required explicit `this.` and `global.` prefixes for all scope and global variable access inside scopes (ADR-016). This was verbose and unfamiliar to developers coming from C, where identifiers resolve automatically using lexical scoping.

Example of the old verbose syntax:

```cnx
scope Motor {
    u32 speed <- 0;

    void accelerate() {
        this.speed +<- 10;        // Required this.
        global.LED.on();           // Required global.
    }
}
```

## Decision

Implement implicit resolution with priority: **local → scope → global**.

### Resolution Rules

1. **Local variables** (function parameters and local declarations) take highest priority
2. **Scope members** (variables and functions in current scope) are next
3. **Global symbols** (variables, functions, and scope names) are lowest priority

### Explicit Access Preserved

- `this.x` — forces scope-level resolution
- `global.x` — forces global-level resolution

### Context-Aware Member Access

When an identifier appears before `.` (member access), scope names are prioritized:

- `LED.on()` — if `LED` is a known scope, resolves as scope access
- Even if a global variable `LED` exists, `LED.on()` calls the scope function

### Shadowing

Silent shadowing is allowed (matching C behavior):

```cnx
u32 count <- 1000;  // Global

scope Counter {
    u32 count <- 100;  // Scope - shadows global

    void test() {
        u32 count <- 10;       // Local - shadows scope
        // count = 10, this.count = 100, global.count = 1000
    }
}
```

### Type positions

The rules above are the **value** side. Type positions take the same rule: inside
`scope A`, a bare `B` at a type position resolves to `A`'s own `B` when `A`
declares one.

Before this was decided the type side did not resolve at all, and the generated C
carried a bare name that no longer existed. The observable output was
non-compiling C, `.c`/`.h` signature mismatches, and a fabricated
`typedef struct B B;` for a type that was never declared.

**Qualify from the parse tree, never from a resolved name.** Once a type name has
been reduced to a string, `global.Mode` and a bare `Mode` are byte-identical, so
anything that qualifies after that point silently rewrites `global.` references to
the scope-local type. A bare name is the only form that resolves; `this.T`,
`global.T` and `Scope.T` each state their answer in the syntax and keep it.

**A scope-declared type is named `Scope__Type`.** A type declared inside a scope
carries the scope in its generated C name, and so do its members:

```cnx
enum Config { OFF, ON }          // global -> Config, Config__OFF

scope Timing {
    public enum Config { IDLE }  // -> Timing__Config, Timing__Config__IDLE
}
```

The two never collide, at any nesting depth, because ADR-063 makes the join
injective. Inside `scope Timing` a bare `Config` therefore means `Timing__Config`;
`global.Config` still names the global one.

**Resolution is kind-aware.** A scope member captures a bare name at a type
position only if that member is itself a type. A scope function _is_ a type
(ADR-029), so it captures; a scope **variable** is not, so it does not — a scope
variable named `Config` leaves a global `struct Config` reachable by its bare
name.

**Declaration order does not affect resolution.** A bare type name resolves the
same way whether its declaration appears above or below the use, and whether the
declaration is in the same file or an included one.

### Shadowing does not hide the outer name

`this.` and `global.` see **past** a shadow. All three levels are reachable from
the same function:

```cnx
u32 count <- 1000;

scope Counter {
    u32 count <- 100;

    public u32 test() {
        u32 count <- 10;
        return count + this.count + global.count;   // 10 + 100 + 1000
    }
}
```

**Output definition.** C has no `::`, so this guarantee has a consequence for the
generated C: a local emitted as plain `count` would make the file-scope `count`
unreachable for the rest of the function, and `global.count` would silently bind
to the local. The **local** therefore moves, not the global — it is emitted as
`Scope__function__local`:

```c
uint32_t count = 1000U;
static uint32_t Counter__count = 100U;

uint32_t Counter__test(void) {
    uint32_t Counter__test__count = 10U;
    return Counter__test__count + Counter__count + count;
}
```

This applies to any local that would shadow a **file-scope** name — plain
variables, arrays, `string<N>` values and `for` init variables alike — and to
**writes** as well as reads. A write is the case that matters: `buf[0] <- 5` on a
shadowing local that kept its bare name lands on the global, compiles under
`-Wall -Wextra`, and is invisible until runtime. A local that shadows nothing,
or that shadows only an enclosing _local_, keeps its own name: C block scoping
already gives the right answer there, and neither `this.` nor `global.` can name
an enclosing local. The generated file is a certification artifact, so names stay
plain wherever the language does not require otherwise.

Two gaps are tracked rather than hidden: a **parameter** that shadows a
file-scope name is not yet covered (#1290), and the "is this name taken at file
scope" test is currently answered run-wide rather than per translation unit, so
an unrelated file in the same build can qualify a local that did not need it
(#1291). The second errs toward renaming on purpose — a missed rename is silently
wrong code, an unnecessary one is only a longer name.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist** for
this feature, `warn` that it should be covered and is not, `error` that it must
be. Undeclared cells are `off`.

Nine cells are `error` and three are `warn`. All twelve began as `warn`,
deliberately and as a first step: this ADR had no matrix since it was written in
January, which per [`README.md`](README.md) is indistinguishable from claiming
the feature cannot occur anywhere — a claim that is plainly false for a rule
governing every bare identifier in the language. Declaring twelve `warn` cells
converted that silence into a visible, non-blocking backlog, and #1241 then made
nine of them occupiable, so they were promoted.

`warn` is a statement about coverage, not about possibility. The `off` claims
have not been made here because `off` is a claim about the grammar and must be
argued by trying to _write_ the program that would occupy the cell. That work
belongs with the fixtures (#1285), not ahead of them. Cells will be promoted to
`error` as fixtures reach them, and any cell that stays `warn` will carry its
reason and a filed follow-up.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | warn     |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | imported direct     | warn     |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported transitive | warn     |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |

**ADR-057 raises no diagnostic of its own** — it is a resolution and codegen-shape
rule throughout — so while a cell's context could only come from an
`.expected.error` position, all twelve rows were unoccupiable and stood at `warn`
recording an obligation nothing could meet. #1241 (2026-08-29) is that
resolution: occupancy now also derives from where the rule fired, recorded at the
decision (`TypeValidator.ts`, `TypeGenerationHelper.ts`, `FunctionCallAnalyzer.ts`,
`AdrProvenance.record("057", ...)`).

Nine cells are occupied and are now `error`. The three `global variable` rows stay
`warn`, and **a fixture alone cannot green them** — worth stating, because that is
the obvious next move and it does not work. `FixtureContext.at()` reaches
`global-variable` only at a file-scope declaration (`inScope == false &&
inFunction == false && inVariable == true`), and all four ADR-057 recording sites
are gated on being inside a scope or on a local: `TypeValidator.ts:441`
(`isLocalVariable`), `TypeValidator.ts:458` and `FunctionCallAnalyzer.ts:800`
(`currentScope`), `TypeGenerationHelper.ts:228` (returns unchanged with no scope).
With no diagnostic either, there is no `.expected.error` route.

So these three want a **fifth recording site** for file-scope resolution, not more
fixtures. Tracked as #1407. `off` would be the wrong claim: a bare name resolving
to a file-scope variable is squarely this ADR's rule, so the cell can exist.

The axes still cannot see syntactic form: a bare `read()` and a
qualified `this.read()` inside the same scope method derive the same cell, which
is exactly how #1210 and #1244 reached `main`. Both spellings need fixtures even
though they share a cell.

## Consequences

### Positive

- More natural syntax matching C developer expectations
- Less verbose code — no mandatory prefixes
- Backward compatible — explicit `this.` and `global.` still work
- Cross-scope access simplified — `OtherScope.method()` works without `global.`

### Negative

- Silent shadowing may cause subtle bugs (mitigated by explicit access when needed)
- Resolution logic in the transpiler is correspondingly more complex
- A local that shadows a file-scope name is emitted under a qualified C name,
  so the generated identifier does not always match the source one
- The rule is spelled more than one way. A bare name and its qualified equivalent
  compile to the same thing, so a defect in one spelling is invisible to a fixture
  written in the other

## Open Questions

None.

## References

- Issue #1130 — bare scope-local type names emitted unqualified; established the
  type-position half of this decision
- Issue #1210 — bare intra-scope call reached E0708 differently from `this.`-qualified
- Issue #1244 — scope member shadowing a global
- Issue #1285 — qualified names re-derived rather than computed once; the
  implementation this ADR previously described in detail is being replaced, which
  is why that description is no longer carried here
- ADR-063 — makes the qualified-name join injective, so a resolved name identifies
  its symbol without needing a scope to interpret it
- Fixtures: `tests/adr-057/` (including `shadow-global-from-scope-method.test.cnx`,
  the execution test pinning all three levels at once),
  `tests/bugs/issue-1210-bare-intra-scope-call/`,
  `tests/bugs/issue-1244-adr057-scope-member-shadow/`
- Issue #1290 — a parameter shadowing a file-scope name is not yet covered
