# FreeRTOS Integration Findings

**Library:** FreeRTOS-Kernel V11.2.0
**Issue:** #931
**Started:** 2026-02-24
**Status:** ADR-061 Accepted — Ready to implement with C boundary layer

## Test Progress

| Test                | Status      | Notes                                 |
| ------------------- | ----------- | ------------------------------------- |
| FreeRTOSConfig.h    | **Ready**   | Will be plain C file (per ADR-061)    |
| freertos_wrapper.c  | **Ready**   | C boundary layer for void\* callbacks |
| task-typed.test.cnx | Not started | C-Next code calling through wrapper   |

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

## Next Steps

1. Create `FreeRTOSConfig.h` (plain C)
2. Create `freertos_wrapper.c` (C boundary layer)
3. Create `task-typed.test.cnx` (C-Next test)
4. Verify the pattern works end-to-end

## Related

- [ADR-061: C Library Interoperability](/docs/decisions/adr-061-c-library-interop.md)
- [ADR-037: Preprocessor Directive Handling](/docs/decisions/adr-037-preprocessor.md)
- [Issue #931](https://github.com/jlaustill/c-next/issues/931)
