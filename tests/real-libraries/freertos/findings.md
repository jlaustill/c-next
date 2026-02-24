# FreeRTOS Integration Findings

**Library:** FreeRTOS-Kernel V11.2.0
**Issue:** #931
**Started:** 2026-02-24
**Status:** ADR-061 Accepted — Ready to implement with C boundary layer

## Test Progress

| Test                | Status   | Notes                                  |
| ------------------- | -------- | -------------------------------------- |
| FreeRTOSConfig.h    | **Done** | Plain C config file                    |
| task_types.h        | **Done** | Shared types for C and C-Next          |
| freertos_wrapper.c  | **Done** | C boundary layer for void\* callbacks  |
| task-typed.test.cnx | **PASS** | C-Next code with typed TaskData struct |

## Discoveries

### Discovery 1: `#define` Value Constants

**Problem:** C-Next forbids `#define NAME value` (ADR-037 error E0502)

**Solution (ADR-061):** Configuration files stay in C. C-Next includes them directly.

```c
// FreeRTOSConfig.h — stays as C
#define configUSE_PREEMPTION 1
```

```c-next
// app.cnx — includes C config
#include "FreeRTOSConfig.h"
```

---

### Discovery 2: `void*` Generic Pointers

**Problem:** C-Next has no `void*` type (memory safety by design)

**Solution (ADR-061):** C boundary layer handles unsafe casts, calls typed C-Next functions.

```c
// freertos_wrapper.c — C BOUNDARY LAYER
void myTask_wrapper(void* pvParameters) {
    TaskData* data = (TaskData*)pvParameters;  // Unsafe cast in C
    myTask_typed(data);                         // Call typed C-Next function
}
```

```c-next
// my_task.cnx — C-NEXT (SAFE)
public void myTask_typed(TaskData data) {
    data.counter <- data.counter + 1;
}
```

---

## Decision: C is the Escape Hatch

**ADR-061 Accepted** — C-Next follows the TypeScript model:

| TypeScript           | C-Next                 |
| -------------------- | ---------------------- |
| `.ts` files          | `.cnx` files           |
| Safe, typed code     | Safe, typed code       |
| `.d.ts` declarations | `.h/.c` boundary layer |
| JavaScript runtime   | C libraries            |

**Key principle:** C-Next will never have `unsafe` blocks. All unsafe operations (void\* casts, #define values) belong in C files at the boundary layer.

## Validation Complete

The ADR-061 pattern has been validated:

1. **FreeRTOSConfig.h** — Plain C config file (uses #define values)
2. **task_types.h** — Shared types between C and C-Next
3. **freertos_wrapper.c/.h** — C boundary layer (handles void\* casts)
4. **task-typed.test.cnx** — C-Next test using typed structs

The test passes, proving that:

- C-Next can work with C library types
- The boundary layer pattern isolates unsafe operations
- Type safety is maintained in C-Next code

## Related

- [ADR-061: C Library Interoperability](/docs/decisions/adr-061-c-library-interop.md)
- [ADR-037: Preprocessor Directive Handling](/docs/decisions/adr-037-preprocessor.md)
- [Issue #931](https://github.com/jlaustill/c-next/issues/931)
