# Real-World Library Integration Tests Design

**Date:** 2026-02-24
**Issue:** #931
**Status:** Approved

## Summary

Create integration tests using real C/C++ libraries (starting with FreeRTOS) to validate C-Next interop in actual usage scenarios. This will discover transpiler limitations—particularly around `void*` handling—that synthetic tests miss.

## Goals

1. Test C-Next against **real library headers**, not simplified stubs
2. Discover what breaks with real-world C patterns
3. Document findings to inform future ADRs (especially void* interop)
4. Prove bidirectional interop: C-Next includes C headers, C includes C-Next headers

## Non-Goals

- Execute tests against running FreeRTOS (no RTOS environment)
- Fix all discovered issues immediately (some will become ADRs)
- Test cJSON or other libraries in Phase 1

## Directory Structure

```
tests/
├── libs/                          # Real external libraries (vendored)
│   └── FreeRTOS/                  # FreeRTOS-Kernel (pinned version)
│       ├── include/               # FreeRTOS headers
│       │   ├── FreeRTOS.h
│       │   ├── task.h
│       │   └── ...
│       ├── portable/GCC/Posix/    # Linux-compatible port
│       ├── VERSION.txt            # Pinned version for reproducibility
│       └── LICENSE                # MIT license
│
├── real-libraries/                # C-Next tests using real libraries
│   ├── README.md                  # Overview, setup, patterns
│   └── freertos/
│       ├── FreeRTOSConfig.cnx     # C-Next config (transpiles to .h)
│       ├── FreeRTOSConfig.expected.h
│       ├── task-handle.test.cnx   # Step 2: Type resolution
│       ├── task-create.test.cnx   # Step 3: void* callback test
│       └── findings.md            # Documented discoveries
```

## Test Progression

### Step 1: FreeRTOSConfig.cnx (Config Generation)

C-Next source that transpiles to `FreeRTOSConfig.h`, which FreeRTOS headers include.

```c-next
// test-no-exec
// Minimal FreeRTOS configuration in C-Next

#define configUSE_PREEMPTION 1
#define configUSE_IDLE_HOOK 0
#define configMAX_PRIORITIES 5
#define configMINIMAL_STACK_SIZE 128
// ... other required config macros
```

**Tests:** Can C-Next generate a valid header that FreeRTOS accepts?
**Expected:** Should work (just macros)

### Step 2: task-handle.test.cnx (Type Resolution)

```c-next
// test-no-exec
#include "FreeRTOS.h"
#include "task.h"

TaskHandle_t myHandle;
```

**Tests:** Can C-Next parse FreeRTOS typedefs and use opaque handle types?
**Expected:** May hit issues with opaque handle types

### Step 3: task-create.test.cnx (void* Callback Test)

```c-next
// test-no-exec
#include "FreeRTOS.h"
#include "task.h"

struct TaskData {
    u32 counter;
}

void myTaskFunction(???) {  // void* parameter - syntax TBD
    // ...
}

void createTask() {
    TaskData data <- {counter: 0};
    TaskHandle_t handle;

    xTaskCreate(myTaskFunction, "test", 128, ???, 1, handle);
}
```

**Tests:** The void* callback parameter problem
**Expected:** Will fail—this triggers ADR research

## ADR Transition

When Step 3 fails:

1. Document exact error in `findings.md`
2. Create `docs/decisions/adr-XXX-void-pointer-interop.md` with status `Research`
3. Pause implementation work on issue #931

### ADR Research Questions

- How do other safe languages handle C void* interop? (Rust, Zig, etc.)
- What patterns exist in real embedded code for void* usage?
- Should C-Next track types through void* at transpile time?
- Should there be an explicit `opaque<T>` annotation?
- What are the MISRA implications?

### Resume Criteria

- ADR reaches `Accepted` status with a decision
- Implementation continues based on ADR decision

## Success Criteria

- [ ] FreeRTOS-Kernel vendored at `tests/libs/FreeRTOS/` with pinned version
- [ ] `FreeRTOSConfig.cnx` transpiles to valid header FreeRTOS accepts
- [ ] Type resolution test passes (or failure documented)
- [ ] void* test failure triggers ADR with clear problem statement
- [ ] All findings documented in `findings.md`

## Out of Scope for Phase 1

- cJSON testing (deferred until void* ADR resolved)
- Execution tests (compile-check only)
- Transpiler changes (those come from ADR decisions)
- Other FreeRTOS APIs beyond xTaskCreate
