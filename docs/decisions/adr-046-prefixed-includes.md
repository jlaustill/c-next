# ADR-046: Prefixed Includes

## Status

**Research**

## Context

C headers pollute the global namespace with all their symbols. When you `#include <compass.h>`, you get `North`, `South`, `East`, `West` as global names that can conflict with your own code.

```c
#include <compass.h>

// Oops! Your "North" conflicts with compass.h's "North"
const int North = 0;  // Error: redefinition
```

Other languages solve this with module systems:

- Python: `import compass as Compass` → `Compass.North`
- JavaScript: `import * as Compass from 'compass'` → `Compass.North`
- Rust: `use compass::*` with renaming

C-Next needs a way to import C headers without namespace pollution.

## Decision Drivers

1. **Namespace Pollution** - C headers dump everything into global scope
2. **Naming Conflicts** - Common names like `Error`, `Status`, `Init` clash
3. **C Compatibility** - Must work with existing C libraries
4. **Clarity** - Clear where each symbol comes from

## Proposed Syntax

```cnx
#includePrefixed <compass.h> Compass

// Now all symbols from compass.h are accessed as:
Compass.North
Compass.South
Compass.getDirection()
```

### Multiple Includes

```cnx
#includePrefixed <motor.h> Motor
#includePrefixed <sensor.h> Sensor

Motor.init();
Sensor.read();
```

### Mixed with Regular Includes

```cnx
#include <stdint.h>              // Standard library - no prefix needed
#includePrefixed <vendor_lib.h> Vendor  // Vendor code - prefixed
```

## Research Questions

### 1. How does the transpiler know what symbols are in the header?

Options:

- Parse the C header file
- Require a manifest/declaration file
- Use naming conventions
- Compile-time discovery via C compiler

### 2. What symbol types need prefixing?

- Functions: `Compass.getDirection()` → `Compass_getDirection()`?
- Constants/enums: `Compass.NORTH` → `COMPASS_NORTH`?
- Types/structs: `Compass.Point` → `Compass_Point`?
- Macros: Cannot be prefixed (preprocessor limitation)

### 3. How to handle nested includes?

If `compass.h` includes `direction.h`, what happens to those symbols?

### 4. What about types used in function signatures?

```c
// In compass.h:
typedef struct { int x, y; } Point;
Point getPosition(void);
```

If `Point` is prefixed to `Compass.Point`, do function return types also change?

### 5. Macro limitations

C macros cannot be prefixed - they're text substitution before compilation:

```c
#define COMPASS_MAX_SPEED 100
```

This would still be global. Document as limitation?

## Implementation Approaches

### Approach A: Source Transformation

The Cnx transpiler parses the C header and generates prefixed wrappers:

```cnx
#includePrefixed <compass.h> Compass
```

Generates:

```c
#include <compass.h>

// Wrapper or alias generation
static inline Direction Compass_getDirection(void) {
    return getDirection();
}
```

**Pros:** Full control over naming
**Cons:** Complex, need to parse C headers

### Approach B: Scope-Based Rewriting

Treat the prefix as a Cnx scope and rewrite calls during transpilation:

```cnx
#includePrefixed <compass.h> Compass

void main() {
    Direction d <- Compass.getDirection();
}
```

Transpiles to:

```c
#include <compass.h>

void main() {
    Direction d = getDirection();  // Scope prefix stripped
}
```

**Pros:** Simple transformation
**Cons:** Only helps Cnx code, not actual C namespace

### Approach C: Manifest Files

Require a `.cnxlib` manifest describing the header:

```yaml
# compass.cnxlib
header: compass.h
symbols:
  - name: getDirection
    type: function
  - name: NORTH
    type: constant
```

**Pros:** Explicit, no C parsing needed
**Cons:** Extra maintenance burden

## Open Questions

1. Is this feature worth the implementation complexity?
2. Should this be a v1 or v2 feature?
3. How do other C-to-safer-language transpilers handle this?
4. What about C++ namespaces in headers?

## Alternatives Considered

### Just Use Naming Conventions

Libraries already use prefixes: `SDL_Init()`, `GPIO_Write()`, etc.
Developers could just choose non-conflicting names.

**Rejected:** Doesn't help with third-party libraries you don't control.

### Wrapper Headers

Manually write wrapper headers with prefixed names.

**Rejected:** Manual work, error-prone, maintenance burden.

## References

- Python import system
- JavaScript ES6 modules
- Rust `use` and `as` keywords
- C++ namespaces (not available in C)
- ADR-037: Preprocessor (related)
- ADR-016: Scope (related - uses similar prefix mechanism)
