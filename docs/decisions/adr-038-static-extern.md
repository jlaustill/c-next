# ADR-038: Static and Extern Keywords

## Status
**Research**

## Context

C's storage class specifiers:
- `static` in function: local persistence across calls
- `static` at file scope: internal linkage (private to file)
- `extern`: external linkage (defined elsewhere)

Essential for multi-file projects.

## Decision Drivers

1. **Multi-File Projects** - Share/hide symbols across files
2. **State Persistence** - Static locals keep values
3. **C Compatibility** - Same semantics as C
4. **Visibility Control** - Ties into scope (ADR-016)

## Recommended Decision

**Support `static` and `extern`** with C semantics.

## Syntax

### Static Local Variable
```cnx
void counter() {
    static u32 count <- 0;  // Persists across calls
    count +<- 1;
    return count;
}

counter();  // Returns 1
counter();  // Returns 2
counter();  // Returns 3
```

### Static Function (File-Private)
```cnx
// Only visible in this file
static void helperFunction() {
    // implementation
}

// Public function
void publicAPI() {
    helperFunction();
}
```

### Static Global (File-Private)
```cnx
// Only visible in this file
static u32 moduleState <- 0;

void updateState(u32 value) {
    moduleState <- value;
}
```

### Extern Declaration
```cnx
// Declare variable defined elsewhere
extern u32 globalCounter;

// Declare function defined elsewhere
extern void externalFunction(u32 param);

void useExternals() {
    externalFunction(globalCounter);
}
```

### Extern in Header
```cnx
// config.h
extern const u32 SYSTEM_CLOCK;
extern void systemInit();

// config.cnx
const u32 SYSTEM_CLOCK <- 48000000;
void systemInit() { ... }
```

## Implementation Notes

### Grammar Changes
```antlr
storageClassSpecifier
    : 'static'
    | 'extern'
    ;

variableDeclaration
    : storageClassSpecifier? constModifier? type IDENTIFIER ...
    ;

functionDeclaration
    : storageClassSpecifier? type IDENTIFIER ...
    ;
```

### Scope Integration
With ADR-016 scope:
```cnx
scope Internal {
    // Private by default - generates static
    void helper() { }

    // Public - no static
    public void api() { }
}
```

Could generate:
```c
static void Internal_helper(void) { }
void Internal_api(void) { }
```

### CodeGenerator
Direct mapping to C:
```c
static uint32_t count = 0;
extern uint32_t globalCounter;
static void helperFunction(void) { }
```

### Priority
**High** - Required for real multi-file projects.

## Open Questions

1. Integration with scope visibility?
2. Header generation for extern?
3. Warn on extern without definition?

## References

- C storage classes
- Linkage in C
