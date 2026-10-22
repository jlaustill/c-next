# FreeRTOS Integration Findings

**Library:** FreeRTOS-Kernel V11.2.0
**Issue:** #931
**Started:** 2026-02-24
**Status:** ADR-061 Accepted — Ready to implement with C boundary layer

## Test Progress

| Test                | Status   | Notes                                 |
| ------------------- | -------- | ------------------------------------- |
| FreeRTOSConfig.h    | **Done** | Plain C config file                   |
| task_types.h        | **Done** | Shared types for C and cnx            |
| freertos_wrapper.c  | **Done** | C boundary layer for void\* callbacks |
| task-typed.test.cnx | **PASS** | cnx code with typed TaskData struct   |

## Discoveries

### Discovery 1: `#define` Value Constants

**Problem:** cnx forbids `#define NAME value` (ADR-037 error E0502)

**Solution (ADR-061):** Configuration files stay in C. cnx includes them directly.

```c
// FreeRTOSConfig.h — stays as C
#define configUSE_PREEMPTION 1
```

```cnx
// app.cnx — includes C config
#include "FreeRTOSConfig.h"
```

---

### Discovery 2: `void*` Generic Pointers

**Problem:** cnx has no `void*` type (memory safety by design)

**Solution (ADR-061):** C boundary layer handles unsafe casts, calls typed cnx functions.

```c
// freertos_wrapper.c — C BOUNDARY LAYER
void myTask_wrapper(void* pvParameters) {
    TaskData* data = (TaskData*)pvParameters;  // Unsafe cast in C
    myTask_typed(data);                         // Call typed cnx function
}
```

```cnx
// my_task.cnx — cnx (SAFE)
public void myTask_typed(TaskData data) {
    data.counter <- data.counter + 1;
}
```

---

## Decision: C is the Escape Hatch

**ADR-061 Accepted** — cnx follows the TypeScript model:

| TypeScript           | cnx                    |
| -------------------- | ---------------------- |
| `.ts` files          | `.cnx` files           |
| Safe, typed code     | Safe, typed code       |
| `.d.ts` declarations | `.h/.c` boundary layer |
| JavaScript runtime   | C libraries            |

**Key principle:** cnx will never have `unsafe` blocks. All unsafe operations (void\* casts, #define values) belong in C files at the boundary layer.

## Validation Complete

The ADR-061 pattern has been validated:

1. **FreeRTOSConfig.h** — Plain C config file (uses #define values)
2. **task_types.h** — Shared types between C and cnx
3. **freertos_wrapper.c/.h** — C boundary layer (handles void\* casts)
4. **task-typed.test.cnx** — cnx test using typed structs

The test passes, proving that:

- cnx can work with C library types
- The boundary layer pattern isolates unsafe operations
- Type safety is maintained in cnx code

## Related

- [ADR-061: C Library Interoperability](/docs/decisions/adr-061-c-library-interop.md)
- [ADR-037: Preprocessor Directive Handling](/docs/decisions/adr-037-preprocessor.md)
- [Issue #931](https://github.com/smeltworks/cnx/issues/931)
