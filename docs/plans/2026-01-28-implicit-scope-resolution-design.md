# Implicit Scope Resolution Design

**Date:** 2026-01-28
**Status:** Approved
**Related ADR:** TBD (suggest ADR-057 or next available)

## Problem

Currently, C-Next requires explicit `this.` and `global.` prefixes to access scope-level and global variables from within a scope. This is verbose and unfamiliar to developers coming from C, Rust, JavaScript, and other languages that use implicit resolution with shadowing.

```cnx
// Current (verbose)
scope CurrentState {
    u8 currentValue <- 0;
    void update() {
        this.currentValue <- global.millis() % 2;
    }
}

// Desired (natural)
scope CurrentState {
    u8 currentValue <- 0;
    void update() {
        currentValue <- millis() % 2;
    }
}
```

## Solution

Implement implicit variable resolution with a defined priority order, while preserving explicit prefixes for when developers need precision.

## Resolution Rules

### Priority Order (inside a scope)

1. **Local** — Variables declared in current function + parameters
2. **Scope** — Members of the current scope
3. **Global** — Global variables, functions, and scope names

Outside a scope: Local → Global (no scope level).

### Context-Aware Resolution

**Value context** (bare identifier):

```
local variable → scope member → global variable
```

**Member access context** (identifier before `.`):

```
scope name → struct variable
```

This distinction allows:

```cnx
u8 LED <- 5;                          // global variable
scope LED { public void on() {} }     // scope

scope Motor {
    void test() {
        u8 x <- LED;    // Global variable (5)
        LED.on();       // Scope function (dot triggers scope lookup)
    }
}
```

### Explicit Prefixes

Always available for precision:

- `this.x` — Forces scope-level resolution (error if not in a scope)
- `global.x` — Forces global-level resolution (bypasses local/scope)

### Shadowing

**Silent shadowing** — No warnings when local shadows scope or global. Matches C behavior.

```cnx
scope CurrentState {
    u8 currentValue <- 0;

    void updateCurrentValue() {
        u8 currentValue <- millis() % 2;  // shadows this.currentValue
        this.currentValue <- currentValue; // explicit access to scope level
    }
}
```

### Cross-Scope Access

Scope names are part of the global namespace. No `global.` prefix required:

```cnx
scope LED {
    public u8 brightness <- 100;
    public void on() { /* ... */ }
}

scope Motor {
    void adjust() {
        u8 b <- LED.brightness;  // Works (previously needed global.LED.brightness)
        LED.on();                // Works
    }
}
```

### Name Collision: Local vs Scope Name

If a local variable shadows a scope name, local wins. Scope becomes inaccessible from that function:

```cnx
scope Motor {
    void broken() {
        u8 LED <- 5;
        LED.on();  // Error: u8 has no member 'on'
    }
}
```

## Implementation

### Location

Code generation changes in `src/codegen/CodeGenerator.ts`:

- `generatePrimaryExpr()` — bare identifier handling
- Postfix chain handling — member access after resolution

### No Grammar Changes

The ANTLR grammar already parses bare identifiers. This is purely a code generation change.

### Backward Compatible

Existing code using `this.` and `global.` continues to work unchanged.

### New Bare Identifier Logic

```
1. If local variable or parameter → use it
2. If inside scope AND matches scope member → return ScopeName_identifier
3. If identifier before '.' AND matches scope name → return identifier (scope access)
4. If global variable or function → return identifier
5. Otherwise → error "used before defined"
```

## Testing

### Basic Tests

```
tests/scope-resolution/
  ├── bare-scope-member.test.cnx       # Bare identifier → scope member
  ├── local-shadows-scope.test.cnx     # Shadowing with this. access
  ├── cross-scope-access.test.cnx      # LED.on() from Motor
  ├── bare-function-call.test.cnx      # Calling scope functions bare
  └── shadowing-all-levels.test.cnx    # Local/scope/global combo
```

### Error Tests

```
  ├── errors/
  │   ├── undefined-variable.test.cnx     # Bare identifier not found
  │   ├── this-outside-scope.test.cnx     # this. at global level
  │   ├── private-cross-scope.test.cnx    # Accessing private member
  │   └── scope-name-shadowed.test.cnx    # Local shadows scope, then .member
```

### Edge Cases

```
  ├── edge-cases/
  │   ├── global-var-same-as-scope.test.cnx    # u8 LED + scope LED coexist
  │   ├── parameter-shadows-scope.test.cnx     # Param shadows scope member
  │   ├── nested-scope-calls.test.cnx          # Scope A calls B calls C
  │   ├── recursive-scope-call.test.cnx        # Scope function calls itself
  │   ├── same-name-all-levels.test.cnx        # "x" at local, scope, global
  │   └── scope-member-same-as-global.test.cnx # Scope.count vs global count
```

## Examples

### Before (current)

```cnx
scope Motor {
    u32 speed <- 0;
    u32 maxSpeed <- 1000;

    public void accelerate() {
        if (this.speed < this.maxSpeed) {
            this.speed +<- 100;
        }
    }

    public void emergencyStop() {
        this.speed <- 0;
        global.LED.on();
    }
}
```

### After (with implicit resolution)

```cnx
scope Motor {
    u32 speed <- 0;
    u32 maxSpeed <- 1000;

    public void accelerate() {
        if (speed < maxSpeed) {
            speed +<- 100;
        }
    }

    public void emergencyStop() {
        speed <- 0;
        LED.on();
    }
}
```

Both forms remain valid — developers can use explicit prefixes when clarity is needed.
