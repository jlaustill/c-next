# ADR-105: Prefixed Includes

## Status

**Research**

## Context

C headers pollute the global namespace with all their symbols. When you `#include <compass.h>`, you get `North`, `South`, `East`, `West` as global names that can conflict with your own code.

```c
#include <compass.h>

// Oops! Your "North" conflicts with compass.h's "North"
const int North = 0;  // Error: redefinition
```

**Multi-library conflicts** are especially problematic in embedded systems. For example, including both `<Arduino.h>` and `<SomeSerialLib.h>` where both define a `Serial` object:

```cnx
#include <Arduino.h>
#include <SomeSerialLib.h>

void main() {
    global.Serial.begin(115200);  // Which Serial? Ambiguous!
}
```

Other languages solve this with module systems:

- Python: `import compass as Compass` → `Compass.North`
- JavaScript: `import * as Compass from 'compass'` → `Compass.North`
- Rust: `use compass::*` with renaming

C-Next needs a way to import C headers without namespace pollution, and ideally allow disambiguation when multiple libraries export the same symbol names.

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

### Approach D: Automatic Filename-Based Namespacing (v2)

Standard `#include` syntax with automatic namespacing based on the header filename:

```cnx
#include <Arduino.h>
#include <SomeSerialLib.h>

void main() {
    Arduino.Serial.begin(115200);      // From Arduino.h
    SomeSerialLib.Serial.begin(9600);  // From SomeSerialLib.h - different Serial!
}
```

Transpiles to:

```c
#include <Arduino.h>
#include <SomeSerialLib.h>

void main() {
    Arduino_Serial_begin(115200);
    SomeSerialLib_Serial_begin(9600);
}
```

**Key behavior:**

- `global.Serial` still works for unqualified access (backwards compatible)
- Filename prefix is automatic — no new syntax needed
- Enables disambiguation when two headers export the same symbol name
- Prefix is stripped from filename: `<path/Arduino.h>` → `Arduino`

**Transpilation rules:**

1. `Arduino.Serial.begin()` → `Arduino_Serial_begin()`
2. `Arduino.config.baudRate` → `Arduino_config.baudRate` (struct member access preserved)
3. `Arduino.LED_PIN` → `Arduino_LED_PIN` (constant)
4. `Arduino.ServoState` → `Arduino_ServoState` (type)

**Open questions specific to this approach:**

1. How to handle structs? Does `Arduino.Point p` become `Arduino_Point p`?
2. What about `typedef`s that reference other types in the same header?
3. Should `global.Serial` continue to work, or require qualification when ambiguous?
4. How to detect symbol origin? (Need to track which symbols came from which header)
5. What if the user wants a different prefix than the filename?
6. How to handle headers with no `.h` extension or unusual names like `Arduino.hpp`?

**Pros:**

- No new syntax — works with existing `#include`
- Familiar to developers from Python/JavaScript module patterns
- Enables same-name symbols from different libraries
- Backwards compatible via `global.` prefix

**Cons:**

- Filename may not be ideal prefix (e.g., `some_vendor_lib_v2.h`)
- Requires tracking symbol provenance through the transpiler
- Generated C code has longer symbol names

---

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

### C Transpilation Challenges (Approach D)

5. **Symbol renaming in C output**: If `Arduino.Serial.begin()` transpiles to `Arduino_Serial_begin()`, the C compiler won't find it — the header declares `Serial_begin()`. Options:
   - Generate wrapper functions: `static inline void Arduino_Serial_begin(int baud) { Serial_begin(baud); }`
   - Use preprocessor macros: `#define Arduino_Serial_begin Serial_begin`
   - Only prefix at C-Next level, strip during transpilation (cosmetic namespacing)

6. **True namespacing vs cosmetic**:
   - **Cosmetic**: `Arduino.Serial.begin()` → `Serial_begin()` (just for C-Next disambiguation)
   - **True**: `Arduino.Serial.begin()` → `Arduino_Serial_begin()` (requires wrapper generation)
   - Cosmetic is simpler but doesn't prevent C-level conflicts

7. **Header parsing requirements**: To know `Serial` comes from `Arduino.h`, we must:
   - Parse the C header to extract symbol names (already done via CResolver)
   - Track symbol provenance (which file declared each symbol)
   - Build a mapping: `{Arduino.h: [Serial, Wire, ...], SomeLib.h: [Serial, ...]}`

8. **Type consistency**: If `Arduino.Point` becomes `Arduino_Point` in generated C:
   - Function signatures using `Point` must also be rewritten
   - Struct field types must be tracked and renamed
   - `typedef` chains must be followed

9. **Extern declarations**: How do we handle symbols already prefixed by their library?
   - `SDL_Init()` from `<SDL.h>` — should it be `SDL.SDL_Init()` or just `SDL.Init()`?
   - Auto-detect existing prefixes and strip them?

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
