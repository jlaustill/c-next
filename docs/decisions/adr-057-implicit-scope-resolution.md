# ADR-057: Implicit Scope Resolution

## Status

Implemented

## Context

C-Next originally required explicit `this.` and `global.` prefixes for all scope and global variable access inside scopes (ADR-016). This was verbose and unfamiliar to developers coming from C, where identifiers resolve automatically using lexical scoping.

Example of old verbose syntax:

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

Implement implicit variable resolution with priority: **local → scope → global**.

### Resolution Rules

1. **Local variables** (function parameters and local declarations) take highest priority
2. **Scope members** (variables and functions in current scope) are next
3. **Global symbols** (variables, functions, and scope names) are lowest priority

### Explicit Access Preserved

- `this.x` - Forces scope-level resolution
- `global.x` - Forces global-level resolution

### Context-Aware Member Access

When an identifier appears before `.` (member access), scope names are prioritized:

- `LED.on()` - If `LED` is a known scope, resolves as scope access
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

### Limitations

**Global shadowing detection**: When `global.X` is used and a local variable `X` exists in the same function, an error is thrown. C cannot access a shadowed global variable from within the shadowing scope.

```cnx
scope Test {
    void broken() {
        u32 count <- 10;       // Local
        u32 x <- global.count; // ERROR: Cannot use global.count when local shadows it
    }
}
```

## Consequences

### Positive

- More natural syntax matching C developer expectations
- Less verbose code - no mandatory prefixes
- Backward compatible - explicit `this.` and `global.` still work
- Cross-scope access simplified - `OtherScope.method()` works without `global.`

### Negative

- Silent shadowing may cause subtle bugs (mitigated by explicit access when needed)
- Slightly more complex resolution logic in transpiler
- `global.X` limitation when local shadows global

## Implementation

### Files Modified

- `src/codegen/TypeValidator.ts` - Added `resolveBareIdentifier()` and `resolveForMemberAccess()`
- `src/codegen/CodeGenerator.ts` - Integrated resolution in `generatePrimaryExpr()` and postfix handling
- `src/analysis/FunctionCallAnalyzer.ts` - Allow bare scope function calls

### Test Coverage

New tests in `tests/scope-resolution/`:

- `bare-scope-member.test.cnx` - Bare identifier resolves to scope member
- `bare-function-call.test.cnx` - Bare function calls within scope
- `cross-scope-access.test.cnx` - Cross-scope access without global.
- `local-shadows-scope.test.cnx` - Local shadowing with this. access
- `shadowing-all-levels.test.cnx` - All three resolution levels
- `edge-cases/global-var-same-as-scope.test.cnx` - Scope name collision

### Type positions (Issue #1130)

The resolution above is the **value** side. Type positions need the same rule:
inside `scope A`, a bare `B` at a type position must resolve to `A`'s own `B`
when `A` declares one. Before #1130 the type side did not resolve at all, so the
generated C carried a bare name that no longer existed — non-compiling output,
`.c`/`.h` signature mismatches, and a fabricated `typedef struct B B;`.

**Key rule — qualify from the parse tree, never from a resolved name.** Once a
type name has been reduced to a string, `global.Mode` and a bare `Mode` are
byte-identical. Any pass that qualifies after that point silently rewrites
`global.` references to the scope-local type. Qualification therefore happens in
the `userType()` branch only; `this.T`, `globalType()` and `qualifiedType()`
carry their answer in the syntax and keep their own branches.

**Kind-awareness.** The predicate keys on the _qualified_ name against the known
enum/struct/bitmap sets, not on scope membership. A scope function or variable
named `Config` must not capture a global `struct Config` at a type position.

**Two resolution points.** Type names are resolved in two layers, and both
qualify through `QualifiedCName.qualifyScopeType()`:

- **Symbols layer** — `TypeUtils.dispatchTypeResolution()`, given an
  `isScopeType` predicate threaded down from `CNextResolver.resolve()`. Consumers
  of `TSymbol` (including `HeaderSymbolAdapter` and therefore the `.h`) inherit
  the qualified name and must not re-qualify. This is what keeps the header
  correct in multi-file builds, where the shared codegen state describes only
  the last file transpiled.
- **Codegen layer** — `CodeGenerator.getTypeName()`, `TypeRegistrationEngine`,
  `FunctionContextManager` and `TypeGenerationHelper`, via
  `CodeGenState.qualifyScopeType()`.

**Declaration-order independence.** `CNextResolver` Pass 0b collects the
qualified names of every scope-declared enum, struct and bitmap before any type
is resolved. Using `scope.members` instead would be wrong twice over: it is
kind-agnostic, and it is still being populated while collectors read it, so a
type declared below its use would resolve differently from one declared above.

### Files Modified (type side)

- `src/utils/QualifiedCName.ts` — `qualifyScopeType()`
- `src/transpiler/state/CodeGenState.ts` — `isScopeType()`, `qualifyScopeType()`
- `src/transpiler/logic/symbols/cnext/index.ts` — Pass 0b
- `src/transpiler/logic/symbols/cnext/utils/TypeUtils.ts` — `userType()` branch
- `src/transpiler/output/codegen/CodeGenerator.ts` — `getTypeName()`
- `src/transpiler/output/codegen/helpers/EnumAssignmentValidator.ts` — compare like-for-like

### Test Coverage (type side)

- `tests/scope/issue-1130-scope-type-qualification.test.cnx` — execution test
  covering enum/struct at local, parameter, return, field and scope-variable
  positions, plus `global.T` and non-type-member shadowing
- `bugs/issue-1130-multi-file-scope-type/` — multi-file reproduction; the header
  defect is invisible to any single-file test
- `src/utils/__tests__/QualifiedCName.test.ts`,
  `src/transpiler/state/__tests__/CodeGenState.test.ts`,
  `src/transpiler/logic/symbols/cnext/__tests__/CNextResolver.integration.test.ts`
