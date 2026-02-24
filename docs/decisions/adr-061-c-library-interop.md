# ADR-061: C Library Interoperability

## Status

**Accepted** — C is the escape hatch; C-Next stays pure

## Context

When testing C-Next against real C libraries like FreeRTOS, we discovered two fundamental interop barriers that prevent C-Next from fully integrating with standard C libraries.

### Discovery Source

Issue #931 set out to test C-Next against real FreeRTOS-Kernel headers (not stubs). Within the first test attempt, we hit two blocking issues.

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

### What C-Next Does

ADR-037 forbids `#define` with values:

```c-next
#define configUSE_PREEMPTION 1  // ERROR E0502: use const instead
const u32 configUSE_PREEMPTION <- 1;  // Transpiles to C const, not #define
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

### What C-Next Does

C-Next has no `void*` type — it's intentionally memory-unsafe:

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

The question: should C-Next have `unsafe` blocks like Rust?

**Answer: No.** C-Next will never have unsafe blocks. C is the escape hatch.

## Decision

### C is the Escape Hatch

C-Next follows the **TypeScript model**:

| TypeScript                | C-Next                 |
| ------------------------- | ---------------------- |
| `.ts` files               | `.cnx` files           |
| Safe, typed code          | Safe, typed code       |
| `.d.ts` declaration files | `.h/.c` boundary layer |
| JavaScript runtime        | C libraries            |

**The architecture:**

```
┌─────────────────────────────────────────────────────────┐
│  C-Next (.cnx)                                          │
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
│  - Thin wrappers that call typed C-Next functions       │
│  - All unsafe operations isolated here                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│  C Library (FreeRTOS, etc.)                             │
│  - void* callbacks                                      │
│  - #define configuration                                │
│  - Unchanged, unaware of C-Next                         │
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
    myTask_typed(data);                         // Call typed C-Next function
}

// Registration helper
void createMyTask(TaskData* data, TaskHandle_t* handle) {
    xTaskCreate(myTask_wrapper, "myTask", 128, data, 1, handle);
}
```

```c-next
// my_task.cnx — C-NEXT (SAFE)

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

```c-next
// app.cnx — C-NEXT (SAFE)

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

1. **No language changes** — C-Next stays pure, no `unsafe` blocks
2. **Unified solution** — Same pattern solves both `void*` and `#define`
3. **Explicit boundary** — Clear where unsafe code lives (C files)
4. **Auditable** — Unsafe casts are in small, dedicated files
5. **MISRA compliance** — C-Next code remains fully compliant
6. **Familiar pattern** — Same as TypeScript's `.d.ts` approach

### Tradeoffs

1. **More files** — Requires C wrapper files for void\* callbacks
2. **Manual maintenance** — Wrappers must match C-Next signatures
3. **Learning curve** — Users must understand the boundary pattern

## Consequences

### For Users

- Library configuration files (FreeRTOSConfig.h, etc.) are written in C
- Callbacks using `void*` require thin C wrappers
- C-Next code calls typed wrapper functions, not raw library APIs
- Documentation should provide wrapper templates for common libraries

### For the Transpiler

- No changes required — existing behavior is correct
- ADR-037 (`#define` value restriction) remains unchanged
- No `void*` type will ever be added

### For Documentation

- Add "C Library Integration" guide explaining the boundary pattern
- Provide wrapper templates for FreeRTOS, Arduino, STM32 HAL
- Document that unsafe operations belong in C, not C-Next

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

```c-next
// event_handler.cnx — C-NEXT (SAFE)
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
