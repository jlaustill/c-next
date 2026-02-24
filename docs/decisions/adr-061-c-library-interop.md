# ADR-061: C Library Interoperability

## Status

**Research** — Discovered via Issue #931 (Real-world library integration tests)

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

### Impact

- Cannot write FreeRTOSConfig in C-Next
- Cannot configure any C library that uses `#define` for settings
- Must use plain C headers for all library configuration

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

```c
// C usage pattern
typedef struct { int counter; } TaskData;

void myTask(void* params) {
    TaskData* data = (TaskData*)params;  // Cast back
    data->counter++;
}

void createTask() {
    TaskData data = {0};
    xTaskCreate(myTask, "test", 128, &data, 1, NULL);  // Pass as void*
}
```

### What C-Next Does

C-Next has no `void*` type — it's intentionally memory-unsafe:

- No way to declare a function that accepts `void*`
- No way to cast to/from `void*`
- No way to call C functions that expect `void*` callbacks

### Impact

- Cannot implement FreeRTOS task functions
- Cannot use any C callback API that uses `void*` for user data
- Affects: FreeRTOS, POSIX threads, most event systems, GUI callbacks

## Research Questions

### For `#define` Values

1. **Allow `#define` in `.config.cnx` files?** — Special file type for C library config
2. **Pass-through syntax?** — `#pragma c_define configUSE_PREEMPTION 1`
3. **Accept plain C headers?** — Document that config files must be C, not C-Next
4. **Hybrid approach?** — C-Next wrapper that `#include`s a C config header

### For `void*` Handling

1. **How do other safe languages handle this?**
   - Rust: `*mut c_void` with unsafe blocks
   - Zig: `*anyopaque` with explicit casts
   - Ada: `System.Address` with unchecked conversions

2. **Type tracking through void\*?**
   - Track what type was passed to void\* parameter
   - When void\* returns (in callback), infer original type
   - Requires flow analysis across call boundaries

3. **Explicit opaque annotation?**

   ```c-next
   // Hypothetical syntax
   void myTask(opaque<TaskData> params) {
       params.counter <- params.counter + 1;
   }
   ```

4. **Require C wrapper functions?**
   - User writes thin C shim that casts void\* to typed pointer
   - C-Next calls the typed C function
   - Pushes unsafe code to C boundary

5. **MISRA implications?**
   - MISRA C:2012 Rule 11.5: Conversion from void\* to pointer requires care
   - Any solution should maintain MISRA compliance where possible

## Patterns in Real Embedded Code

### Pattern A: Callback with User Data (Most Common)

```c
// Registration
void register_callback(void (*callback)(void* user_data), void* user_data);

// Usage
typedef struct { int pin; } LedState;
void led_callback(void* data) { LedState* s = data; toggle(s->pin); }
LedState state = {13};
register_callback(led_callback, &state);
```

### Pattern B: Generic Container

```c
// FreeRTOS queue - stores void* to any data
QueueHandle_t xQueueCreate(UBaseType_t length, UBaseType_t itemSize);
BaseType_t xQueueSend(QueueHandle_t queue, const void* item, TickType_t wait);
BaseType_t xQueueReceive(QueueHandle_t queue, void* buffer, TickType_t wait);
```

### Pattern C: Opaque Handle (Already Supported)

```c
// Handle is pointer to incomplete type - C-Next handles this
typedef struct TaskControlBlock* TaskHandle_t;
```

## Decision

**TBD** — Requires discussion and decision on:

1. Approach for `#define` value constants in library configs
2. Approach for `void*` in callback signatures and generic APIs
3. Whether these need separate solutions or a unified approach
4. Acceptable safety/ergonomics tradeoffs

## Consequences

**TBD** — Will depend on chosen approach.

## Related

- ADR-037: Preprocessor Directive Handling (forbids `#define` values)
- ADR-006: No Raw Pointers (design principle)
- Issue #931: Real-world C/C++ library integration tests (discovery source)
