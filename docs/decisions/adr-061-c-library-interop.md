# ADR-061: C Library Interoperability

## Status

**Accepted** — C is the escape hatch; cnx stays pure

## Context

When testing cnx against real C libraries like FreeRTOS, we discovered two fundamental interop barriers that prevent cnx from fully integrating with standard C libraries.

### Discovery Source

Issue #931 set out to test cnx against real FreeRTOS-Kernel headers (not stubs). Within the first test attempt, we hit two blocking issues.

## Problem 1: `#define` Value Constants

### What C Libraries Need

FreeRTOS (and most C libraries) use `#define` for configuration:

```c
// FreeRTOSConfig.h - REQUIRED by FreeRTOS
#define configUSE_PREEMPTION 1
#define configMAX_PRIORITIES 5
#define configTICK_RATE_HZ 1000
```

These are used in **preprocessor conditionals**:

```c
// FreeRTOS.h
#if ( configUSE_PREEMPTION == 0 )
    // co-operative scheduling
#endif
```

### What cnx Does

ADR-037 forbids `#define` with values:

```cnx
#define configUSE_PREEMPTION 1  // ERROR E0502: use const instead
u32 configUSE_PREEMPTION <- 1; // Transpiles to C const, not #define
```

**The problem:** C `const` variables cannot be used in `#if` preprocessor conditionals. The preprocessor runs before the compiler sees `const` declarations.

## Problem 2: `void*` Generic Pointers

### What C Libraries Need

FreeRTOS task creation uses `void*` for generic parameter passing:

```c
// FreeRTOS task function signature
typedef void (*TaskFunction_t)(void* pvParameters);

// Task creation API
BaseType_t xTaskCreate(
    TaskFunction_t pxTaskCode,
    const char* pcName,
    configSTACK_DEPTH_TYPE usStackDepth,
    void* pvParameters,      // <-- generic pointer
    UBaseType_t uxPriority,
    TaskHandle_t* pxCreatedTask
);
```

Pattern: Pass typed data in, receive `void*` in callback, cast back to original type.

### What cnx Does

cnx has no `void*` type — it's intentionally memory-unsafe:

- No way to declare a function that accepts `void*`
- No way to cast to/from `void*`
- No way to call C functions that expect `void*` callbacks

## Research

### How Other Safe Languages Handle void\*

**Rust** ([Rust Closures in FFI](https://adventures.michaelfbryan.com/posts/rust-closures-in-ffi)):

- Uses `*mut c_void` with `unsafe` blocks
- Trampoline pattern: generic function captures type at compile time
- Cast isolated in one `unsafe` location

**Zig** ([Callback with userdata Zig way](https://ziggit.dev/t/callback-with-userdata-zig-way/5203)):

- Uses `*anyopaque` (equivalent to `void*`)
- Wrapper structs with init methods encapsulate the cast
- Type safety thrown away at cast point

### Key Insight

Both languages accept that `void*` loses type information. They provide mechanisms to:

1. Isolate the unsafe cast in a small, auditable location
2. Use generics to maintain type info at compile time
3. Trust the developer to cast correctly when void\* returns

The question: should cnx have `unsafe` blocks like Rust?

**Answer: No.** cnx will never have unsafe blocks. C is the escape hatch.

### Follow-up: cJSON Public API Macros

Phase 2 issue #931 testing against cJSON v1.7.19 found another boundary-layer use case: cJSON declares public functions through the `CJSON_PUBLIC(type)` function-like macro.

```c
CJSON_PUBLIC(cJSON *) cJSON_Parse(const char *value);
CJSON_PUBLIC(cJSON *) cJSON_CreateArray(void);
```

cnx does not collect these macro-wrapped declarations as direct callable symbols from the raw header. The same ADR-061 pattern works: expose plain typed wrapper prototypes in a C boundary header, and delegate to cJSON from the `.c` implementation.

```c
cJSON* cnext_cjson_parse(const char* text);
cJSON* cnext_cjson_create_array(void);
```

This also keeps cJSON ownership details (`cJSON_Delete`, `cJSON_free`) in the C boundary layer while cnx uses typed `cJSON` handles inferred as `cJSON*`.

## Decision

### C is the Escape Hatch

cnx follows the **TypeScript model**:

| TypeScript                | cnx                    |
| ------------------------- | ---------------------- |
| `.ts` files               | `.cnx` files           |
| Safe, typed code          | Safe, typed code       |
| `.d.ts` declaration files | `.h/.c` boundary layer |
| JavaScript runtime        | C libraries            |

**The architecture:**

```
┌─────────────────────────────────────────────────────────┐
│  cnx (.cnx)                                          │
│  - No void*                                             │
│  - No #define values                                    │
│  - No unsafe blocks                                     │
│  - Type-safe, MISRA-compliant                           │
└─────────────────────────────────────────────────────────┘
                          │
                          │ includes / calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│  C Boundary Layer (.h/.c)                               │
│  - void* casts                                          │
│  - #define config values                                │
│  - Thin wrappers that call typed cnx functions       │
│  - All unsafe operations isolated here                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│  C Library (FreeRTOS, etc.)                             │
│  - void* callbacks                                      │
│  - #define configuration                                │
│  - Unchanged, unaware of cnx                         │
└─────────────────────────────────────────────────────────┘
```

### Solution for void\* Callbacks

User writes a thin C wrapper that handles the unsafe cast:

```c
// freertos_wrapper.c — C BOUNDARY LAYER

#include "FreeRTOS.h"
#include "task.h"
#include "my_task.h"  // Generated from my_task.cnx

// C wrapper - handles void* cast
void myTask_wrapper(void* pvParameters) {
    TaskData* data = (TaskData*)pvParameters;  // Unsafe cast in C
    myTask_typed(data);                         // Call typed cnx function
}

// Registration helper
void createMyTask(TaskData* data, TaskHandle_t* handle) {
    xTaskCreate(myTask_wrapper, "myTask", 128, data, 1, handle);
}
```

```cnx
// my_task.cnx — cnx (SAFE)

struct TaskData {
    u32 counter;
    u32 maxCount;
}

// Typed function - no void*, fully safe
public void myTask_typed(TaskData data) {
    data.counter <- data.counter + 1;
}
```

### Solution for #define Configuration

Configuration files stay in C:

```c
// FreeRTOSConfig.h — C BOUNDARY LAYER

#ifndef FREERTOS_CONFIG_H
#define FREERTOS_CONFIG_H

#define configUSE_PREEMPTION 1
#define configMAX_PRIORITIES 5
#define configTICK_RATE_HZ 1000
// ... other config

#endif
```

```cnx
// app.cnx — cnx (SAFE)

#include "FreeRTOSConfig.h"  // Include C config
#include "FreeRTOS.h"
#include "task.h"
#include "freertos_wrapper.h"  // Include C wrapper

void startApp() {
    TaskData data <- {counter: 0, maxCount: 100};
    TaskHandle_t handle;
    createMyTask(data, handle);  // Call through typed wrapper
}
```

### Benefits

1. **No language changes** — cnx stays pure, no `unsafe` blocks
2. **Unified solution** — Same pattern solves both `void*` and `#define`
3. **Explicit boundary** — Clear where unsafe code lives (C files)
4. **Auditable** — Unsafe casts are in small, dedicated files
5. **MISRA compliance** — cnx code remains fully compliant
6. **Familiar pattern** — Same as TypeScript's `.d.ts` approach

### Tradeoffs

1. **More files** — Requires C wrapper files for void\* callbacks
2. **Manual maintenance** — Wrappers must match cnx signatures
3. **Learning curve** — Users must understand the boundary pattern

## Consequences

### For Users

- Library configuration files (FreeRTOSConfig.h, etc.) are written in C
- Callbacks using `void*` require thin C wrappers
- cnx code calls typed wrapper functions, not raw library APIs
- Documentation should provide wrapper templates for common libraries

### For the Transpiler

- No changes required — existing behavior is correct
- ADR-037 (`#define` value restriction) remains unchanged
- No `void*` type will ever be added

### For Documentation

- Add "C Library Integration" guide explaining the boundary pattern
- Provide wrapper templates for FreeRTOS, Arduino, STM32 HAL
- Document that unsafe operations belong in C, not cnx

## Examples

### FreeRTOS Task with Typed Callback

See the Solution sections above for complete example.

### Event Handler Pattern

```c
// event_wrapper.c — C BOUNDARY LAYER
#include "event_handler.h"

void onEvent_wrapper(void* user_data, int event_type) {
    EventContext* ctx = (EventContext*)user_data;
    onEvent_typed(ctx, event_type);
}
```

```cnx
// event_handler.cnx — cnx (SAFE)
struct EventContext {
    u32 count;
}

public void onEvent_typed(EventContext ctx, i32 eventType) {
    ctx.count <- ctx.count + 1;
}
```

## Related

- ADR-037: Preprocessor Directive Handling (forbids `#define` values — unchanged)
- ADR-006: No Raw Pointers (design principle — reinforced)
- Issue #931: Real-world C/C++ library integration tests (discovery source)
- [Rust Closures in FFI](https://adventures.michaelfbryan.com/posts/rust-closures-in-ffi) — research reference
- [Zig Callback Patterns](https://ziggit.dev/t/callback-with-userdata-zig-way/5203) — research reference
