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
