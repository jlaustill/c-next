# ADR-029: Function Pointers

## Status
**Research**

## Context

Function pointers are critical in embedded C:
- Callback functions
- ISR vector tables
- State machine dispatch tables
- Plugin/driver interfaces
- Sort comparators

C's function pointer syntax is notoriously confusing:
```c
void (*callback)(int, int);
int (*compare)(const void*, const void*);
```

## Decision Drivers

1. **Callbacks** - Essential embedded pattern
2. **ISR Tables** - Interrupt vector tables
3. **Clarity** - C syntax is confusing
4. **Type Safety** - Catch mismatched signatures

## Options Considered

### Option A: C-Style Syntax
```cnx
void (*callback)(u32, u32);
callback <- myHandler;
callback(1, 2);
```

**Pros:** Direct C mapping
**Cons:** Ugly, confusing syntax

### Option B: Type Alias Required
```cnx
type Callback <- void(u32, u32);
Callback handler <- myFunction;
handler(1, 2);
```

**Pros:** Clean, readable
**Cons:** Always need typedef

### Option C: `fn` Type Syntax
```cnx
fn(u32, u32) -> void callback <- myHandler;
// or
void fn(u32, u32) callback <- myHandler;
```

**Pros:** Modern feel
**Cons:** New syntax to learn

### Option D: Simplified Pointer Syntax
```cnx
void function(u32, u32) callback <- myHandler;
callback(1, 2);
```

**Pros:** Clear intent
**Cons:** `function` is long

## Recommended Decision

**Option B: Type Alias Required** with clean syntax.

Function pointer types should always be aliased for clarity.

## Syntax

### Define Function Pointer Type
```cnx
type Callback <- void(u32 value);
type Comparator <- i32(const void a, const void b);
type ISRHandler <- void();
```

### Declare and Use
```cnx
Callback onComplete <- handleComplete;
onComplete(42);

// Or inline (less preferred)
void(u32) handler <- handleComplete;
handler(42);
```

### Array of Function Pointers
```cnx
type CommandHandler <- void(u8 data);

CommandHandler handlers[4] <- {
    handleRead,
    handleWrite,
    handleErase,
    handleReset
};

// Dispatch
handlers[cmd](data);
```

### ISR Vector Table
```cnx
type ISR <- void();

const ISR vectors[16] <- {
    resetHandler,
    nmiHandler,
    hardFaultHandler,
    // ...
};
```

### Callback Pattern
```cnx
type EventCallback <- void(u32 event, void data);

struct Timer {
    u32 interval;
    EventCallback callback;
    void userData;
}

void Timer_setCallback(Timer t, EventCallback cb, void data) {
    t.callback <- cb;
    t.userData <- data;
}

void Timer_fire(Timer t) {
    if (t.callback != null) {
        t.callback(TIMER_EXPIRED, t.userData);
    }
}
```

## Implementation Notes

### Grammar Changes
```antlr
// Function pointer type
functionPointerType
    : type '(' parameterTypeList? ')'
    ;

parameterTypeList
    : parameterType (',' parameterType)*
    ;

parameterType
    : constModifier? type IDENTIFIER?
    ;

// In type alias
typeAliasDeclaration
    : 'type' IDENTIFIER '<-' (type | functionPointerType) ';'
    ;
```

### CodeGenerator
```c
// C-Next: type Callback <- void(u32 value);
// C:      typedef void (*Callback)(uint32_t value);

// C-Next: Callback handler <- myFunc;
// C:      Callback handler = myFunc;
```

### Priority
**Critical** - Essential for callbacks, ISRs, and dispatch tables.

## Open Questions

1. Allow inline function pointer declarations without typedef?
2. Null function pointer safety?
3. How to handle `void` parameters (C's void pointer pattern)?

## References

- C function pointers
- Rust fn types
- Zig function types
