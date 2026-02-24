# FreeRTOS Integration Findings

**Library:** FreeRTOS-Kernel V11.2.0
**Issue:** #931
**Started:** 2026-02-24
**Status:** Blocked on ADR-061

## Test Progress

| Test                 | Status      | Notes                                       |
| -------------------- | ----------- | ------------------------------------------- |
| FreeRTOSConfig.cnx   | **Blocked** | Requires `#define` values — see Discovery 1 |
| task-handle.test.cnx | Not started | Blocked by config                           |
| task-create.test.cnx | **Blocked** | Requires `void*` — see Discovery 2          |

## Discoveries

### Discovery 1: `#define` Value Constants

**Test:** FreeRTOSConfig.cnx (not yet created)

**Error:** Would produce E0502 — C-Next forbids `#define NAME value` (ADR-037)

**Analysis:**

FreeRTOS requires configuration via preprocessor defines:

```c
#define configUSE_PREEMPTION 1
#define configMAX_PRIORITIES 5
```

These are used in `#if` conditionals in FreeRTOS.h:

```c
#if ( configUSE_PREEMPTION == 0 )
```

C-Next's recommended alternative (`const u32 configUSE_PREEMPTION <- 1`) transpiles to C `const`, which **cannot** be used in preprocessor `#if` directives.

**Action:** ADR-061 created to research solutions

---

### Discovery 2: `void*` Generic Pointers

**Test:** task-create.test.cnx (not yet created)

**Error:** No C-Next syntax for `void*` parameters or callbacks

**Analysis:**

FreeRTOS task function signature requires `void*`:

```c
typedef void (*TaskFunction_t)(void* pvParameters);

BaseType_t xTaskCreate(
    TaskFunction_t pxTaskCode,
    const char* pcName,
    configSTACK_DEPTH_TYPE usStackDepth,
    void* pvParameters,      // <-- void*
    UBaseType_t uxPriority,
    TaskHandle_t* pxCreatedTask
);
```

C-Next intentionally has no `void*` type (memory safety). There's currently no way to:

- Declare a function accepting `void*`
- Pass typed data where `void*` is expected
- Receive `void*` in a callback and use it as typed data

**Action:** ADR-061 created to research solutions

---

## Conclusion

FreeRTOS integration is **blocked** pending ADR-061 decisions on:

1. How C-Next handles C library configuration (`#define` values)
2. How C-Next handles `void*` in C callbacks

These are fundamental C interop questions that affect all C libraries, not just FreeRTOS.

## Related

- [ADR-061: C Library Interoperability](/docs/decisions/adr-061-c-library-interop.md)
- [ADR-037: Preprocessor Directive Handling](/docs/decisions/adr-037-preprocessor.md)
- [Issue #931](https://github.com/jlaustill/c-next/issues/931)
