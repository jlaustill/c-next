# Issue #948: Forward-Declared Struct Scope Variables

## Problem

When a scope variable has a forward-declared (incomplete) struct type like `widget_t` from `typedef struct _widget_t widget_t;`, the transpiler incorrectly:

1. Generates `static widget_t MyScope_w = {0};` — fails because you can't instantiate incomplete types
2. Uses `&MyScope_w` when passing to functions — creates `widget_t**` instead of `widget_t*`

## Expected Behavior

1. Generate `static widget_t* MyScope_w = NULL;` — pointer to opaque type
2. Pass `MyScope_w` directly — it's already a pointer

## Solution: Track Opaque Types

### 1. SymbolTable Changes

Add opaque type tracking:

```typescript
private readonly opaqueTypes: Set<string> = new Set();

markOpaqueType(typeName: string): void
unmarkOpaqueType(typeName: string): void
isOpaqueType(typeName: string): boolean
getAllOpaqueTypes(): string[]
```

### 2. C Symbol Collection Changes

In `StructCollector.collect()`, detect forward declarations:

- `typedef struct _foo foo;` has no `structDeclarationList()` → mark `foo` as opaque
- When a full struct definition is found later, unmark it

### 3. ICodeGenSymbols Interface

Expose opaque types to codegen:

```typescript
readonly opaqueTypes: ReadonlySet<string>;
```

Add helper in CodeGenState:

```typescript
isOpaqueType(typeName: string): boolean
```

### 4. ScopeGenerator Changes

In `generateRegularVariable()`:

- Check if type is opaque via `orchestrator.isOpaqueType(type)`
- If opaque: append `*` to type, use `NULL` initialization
- Register qualified name via `orchestrator.markOpaqueScopeVariable(fullName)`

### 5. CodeGenState Opaque Variable Tracking

Track which scope variables are opaque pointers:

```typescript
private readonly opaqueScopeVariables: Set<string> = new Set();

markOpaqueScopeVariable(qualifiedName: string): void
isOpaqueScopeVariable(qualifiedName: string): boolean
```

### 6. CodeGenerator Access Changes

When generating `this.member` expression:

- Check `CodeGenState.isOpaqueScopeVariable(qualifiedName)`
- If true: return qualified name directly (no `&` prefix)
- Else: existing logic

## Edge Cases

**Typedef before definition:**

```c
typedef struct _point_t point_t;  // Forward declaration
struct _point_t { int x; int y; };  // Full definition later
```

Solution: `unmarkOpaqueType()` when full definition is found.

## Testing

1. Unit tests for SymbolTable opaque tracking
2. Unit tests for CResolver forward declaration detection
3. Unit tests for ScopeGenerator pointer generation
4. Integration test: `bugs/issue-948-forward-decl-scope-var/`
5. Integration test: `bugs/issue-948-forward-then-define/` (edge case)
6. Run in both C and C++ modes
