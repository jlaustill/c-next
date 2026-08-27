# ADR-057: Implicit Scope Resolution

**Status:** Implemented
**Date:** 2026-01-28 (amended 2026-08-08 — type positions, #1130; amended 2026-08-27 — implementation detail removed, matrix declared, #1285)
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-016 (Scopes — this ADR amends its name-resolution decision), ADR-017 (Enums), ADR-029 (Function Pointers — a function definition also creates a type), ADR-055 (Symbol Resolution Architecture), ADR-063 (Identifier Syntax — makes the qualified name injective)
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

**Resolution is kind-aware.** A scope member captures a bare name at a type
position only if that member is itself a type. A scope function _is_ a type
(ADR-029), so it captures; a scope **variable** is not, so it does not — a scope
variable named `Config` leaves a global `struct Config` reachable by its bare
name.

**Declaration order does not affect resolution.** A bare type name resolves the
same way whether its declaration appears above or below the use, and whether the
declaration is in the same file or an included one.

### Limitations

**Global shadowing.** When `global.X` is used and a local variable `X` exists in
the same function, the program is rejected. C cannot access a shadowed global
from within the shadowing scope, so there is no correct code to generate.

```cnx
scope Test {
    void broken() {
        u32 count <- 10;       // Local
        u32 x <- global.count; // E0425: local 'count' shadows the global
    }
}
```

## Diagnostics

| Code  | Meaning                                               | Raised by                                 |
| ----- | ----------------------------------------------------- | ----------------------------------------- |
| E0425 | `global.X` used where a local variable `X` shadows it | `output/codegen/helpers/CodeGenErrors.ts` |

Actual output, as asserted by
`tests/scope-resolution/global-shadowed-by-local.expected.error`:

```
19:17 Code generation failed: E0425: Cannot use 'global.count' when local
variable 'count' shadows it. Rename the local variable to avoid shadowing.
```

Reported where a `global.` member access names a symbol that a local declaration
in the same function already binds. The generated C has no syntax for reaching
the shadowed global, so this is rejected rather than mis-compiled.

The `line:column` prefix is load-bearing. Codegen diagnostics reach the user
through `ParserUtils.parseErrorLocation`, which recovers a position only from a
literal prefix; without one the error reports at `1:0` and the scope-context
matrix cannot derive which context it fired in, so the cell stays unoccupied no
matter how many fixtures assert it.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist** for
this feature, `warn` that it should be covered and is not, `error` that it must
be. Undeclared cells are `off`.

Every cell is declared `warn`, deliberately and as a first step. This ADR has had
no matrix since it was written in January, which per
[`README.md`](README.md) is indistinguishable from claiming the feature cannot
occur anywhere — a claim that is plainly false for a rule governing every bare
identifier in the language. Declaring twelve `warn` cells converts that silence
into a visible, non-blocking backlog.

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
| top-level function | same file           | warn     |
| scope member       | same file           | warn     |
| scope method       | same file           | warn     |
| global variable    | imported direct     | warn     |
| top-level function | imported direct     | warn     |
| scope member       | imported direct     | warn     |
| scope method       | imported direct     | warn     |
| global variable    | imported transitive | warn     |
| top-level function | imported transitive | warn     |
| scope member       | imported transitive | warn     |
| scope method       | imported transitive | warn     |

Two limits apply and are tracked as #1241. Only a fixture with an
`.expected.error` can occupy a cell, so the type-position rules above — which
govern codegen shape rather than a diagnostic — cannot occupy one until they
raise a diagnostic. And the axes cannot see syntactic form: a bare `read()` and a
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
- `global.X` is unusable where a local shadows the global (E0425)
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
- Fixtures: `tests/scope-resolution/`, `tests/scope/issue-1130-scope-type-qualification.test.cnx`,
  `tests/bugs/issue-1210-bare-intra-scope-call/`,
  `tests/bugs/issue-1244-adr057-scope-member-shadow/`
