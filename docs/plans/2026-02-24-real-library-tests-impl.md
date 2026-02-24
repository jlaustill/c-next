# Real-World Library Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up FreeRTOS-Kernel integration tests to discover C-Next interop limitations, particularly around void* handling.

**Architecture:** Vendor real FreeRTOS headers into `tests/libs/`, write C-Next tests that include them, use `// test-no-exec` marker for compile-only verification. Document discoveries in findings.md, create ADR when void* blocks us.

**Tech Stack:** FreeRTOS-Kernel V11.2.0, C-Next transpiler, GCC (Posix port)

---

## Task 1: Download and Vendor FreeRTOS-Kernel

**Files:**
- Create: `tests/libs/FreeRTOS/` directory structure
- Create: `tests/libs/FreeRTOS/VERSION.txt`

**Step 1: Create directory structure**

```bash
mkdir -p tests/libs/FreeRTOS
```

**Step 2: Download FreeRTOS-Kernel V11.2.0**

```bash
cd tests/libs
curl -L https://github.com/FreeRTOS/FreeRTOS-Kernel/archive/refs/tags/V11.2.0.tar.gz -o freertos.tar.gz
tar -xzf freertos.tar.gz
mv FreeRTOS-Kernel-11.2.0/* FreeRTOS/
rm -rf FreeRTOS-Kernel-11.2.0 freertos.tar.gz
```

**Step 3: Create VERSION.txt**

```bash
echo "FreeRTOS-Kernel V11.2.0" > tests/libs/FreeRTOS/VERSION.txt
echo "Source: https://github.com/FreeRTOS/FreeRTOS-Kernel" >> tests/libs/FreeRTOS/VERSION.txt
echo "Downloaded: 2026-02-24" >> tests/libs/FreeRTOS/VERSION.txt
```

**Step 4: Verify structure**

```bash
ls tests/libs/FreeRTOS/include/
```

Expected: `FreeRTOS.h`, `task.h`, `queue.h`, `semphr.h`, etc.

**Step 5: Commit**

```bash
git add tests/libs/FreeRTOS/
git commit -m "chore: vendor FreeRTOS-Kernel V11.2.0 for real-library tests (Issue #931)"
```

---

## Task 2: Create Test Directory and README

**Files:**
- Create: `tests/real-libraries/README.md`
- Create: `tests/real-libraries/freertos/findings.md`

**Step 1: Create directories**

```bash
mkdir -p tests/real-libraries/freertos
```

**Step 2: Create README.md**

Create `tests/real-libraries/README.md`:

```markdown
# Real-World Library Integration Tests

Tests C-Next interop against real C/C++ library headers (not stubs).

## Purpose

Synthetic tests verify what we *think* might break. Real libraries expose what *actually* breaks:
- Header complexity (nested includes, macros, conditionals)
- Callback patterns (how real APIs expect callbacks registered)
- Type aliasing (typedef chains, platform-specific types)
- void* handling (opaque parameter passing)

## Libraries

| Library | Version | Status | Findings |
|---------|---------|--------|----------|
| FreeRTOS-Kernel | V11.2.0 | In Progress | [findings.md](freertos/findings.md) |

## Running Tests

```bash
# Run all real-library tests
npm test -- tests/real-libraries/

# Run specific library
npm test -- tests/real-libraries/freertos/
```

## Test Markers

All tests use `// test-no-exec` - they transpile and compile but don't execute (no RTOS environment).

## Adding New Libraries

1. Vendor library to `tests/libs/<library>/`
2. Create `tests/real-libraries/<library>/` with tests
3. Document findings in `findings.md`
4. Update this README
```

**Step 3: Create findings.md**

Create `tests/real-libraries/freertos/findings.md`:

```markdown
# FreeRTOS Integration Findings

**Library:** FreeRTOS-Kernel V11.2.0
**Issue:** #931

## Test Progress

| Test | Status | Notes |
|------|--------|-------|
| FreeRTOSConfig.cnx | Pending | Config generation |
| task-handle.test.cnx | Pending | Type resolution |
| task-create.test.cnx | Pending | void* callback |

## Discoveries

### Discovery 1: [TBD]

**Test:** [which test]
**Error:** [exact error message]
**Analysis:** [what this means]
**Action:** [fix / ADR / document]

---

*This file is updated as tests are run and issues discovered.*
```

**Step 4: Commit**

```bash
git add tests/real-libraries/
git commit -m "docs: add real-library test infrastructure (Issue #931)"
```

---

## Task 3: Analyze FreeRTOSConfig.h Requirements

**Files:**
- Read: `tests/libs/FreeRTOS/include/FreeRTOS.h`
- Read: `tests/libs/FreeRTOS/portable/ThirdParty/GCC/Posix/portmacro.h`

**Step 1: Check what FreeRTOS.h requires**

```bash
head -100 tests/libs/FreeRTOS/include/FreeRTOS.h
```

Look for: `#include "FreeRTOSConfig.h"` and required config macros.

**Step 2: Find a reference FreeRTOSConfig.h**

```bash
find tests/libs/FreeRTOS -name "FreeRTOSConfig.h" 2>/dev/null || echo "No example config found"
```

**Step 3: Check portable layer for Posix**

```bash
ls tests/libs/FreeRTOS/portable/ThirdParty/GCC/Posix/ 2>/dev/null || ls tests/libs/FreeRTOS/portable/
```

**Step 4: Document required config macros**

Update `findings.md` with the list of required `config*` macros discovered.

**Step 5: No commit** (research only)

---

## Task 4: Create FreeRTOSConfig.cnx

**Files:**
- Create: `tests/real-libraries/freertos/FreeRTOSConfig.cnx`
- Create: `tests/real-libraries/freertos/FreeRTOSConfig.expected.h`

**Step 1: Write FreeRTOSConfig.cnx**

Create `tests/real-libraries/freertos/FreeRTOSConfig.cnx`:

```c-next
// Minimal FreeRTOS configuration for C-Next interop testing
// This file transpiles to FreeRTOSConfig.h which FreeRTOS includes

#define configUSE_PREEMPTION 1
#define configUSE_IDLE_HOOK 0
#define configUSE_TICK_HOOK 0
#define configCPU_CLOCK_HZ 1000000
#define configTICK_RATE_HZ 1000
#define configMAX_PRIORITIES 5
#define configMINIMAL_STACK_SIZE 128
#define configTOTAL_HEAP_SIZE 10240
#define configMAX_TASK_NAME_LEN 16
#define configUSE_16_BIT_TICKS 0
#define configIDLE_SHOULD_YIELD 1
#define configUSE_MUTEXES 1
#define configUSE_RECURSIVE_MUTEXES 1
#define configUSE_COUNTING_SEMAPHORES 1
#define configQUEUE_REGISTRY_SIZE 8
#define configUSE_QUEUE_SETS 0
#define configUSE_TIME_SLICING 1
#define configSUPPORT_STATIC_ALLOCATION 0
#define configSUPPORT_DYNAMIC_ALLOCATION 1

// Memory allocation
#define configAPPLICATION_ALLOCATED_HEAP 0

// Hook functions
#define configCHECK_FOR_STACK_OVERFLOW 0
#define configUSE_MALLOC_FAILED_HOOK 0

// Co-routine definitions (disabled)
#define configUSE_CO_ROUTINES 0
#define configMAX_CO_ROUTINE_PRIORITIES 2

// Software timer definitions (disabled for minimal config)
#define configUSE_TIMERS 0

// Interrupt nesting (Posix port)
#define configKERNEL_INTERRUPT_PRIORITY 255
#define configMAX_SYSCALL_INTERRUPT_PRIORITY 191

// Optional functions
#define INCLUDE_vTaskPrioritySet 1
#define INCLUDE_uxTaskPriorityGet 1
#define INCLUDE_vTaskDelete 1
#define INCLUDE_vTaskSuspend 1
#define INCLUDE_vTaskDelayUntil 1
#define INCLUDE_vTaskDelay 1
```

**Step 2: Run transpiler to see output**

```bash
npx tsx src/index.ts tests/real-libraries/freertos/FreeRTOSConfig.cnx
```

**Step 3: Create expected.h from output**

Copy the generated header to `FreeRTOSConfig.expected.h`.

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/real-libraries/freertos/FreeRTOSConfig.cnx
```

Expected: PASS (transpile + snapshot match)

**Step 5: Update findings.md**

Mark FreeRTOSConfig.cnx as complete, note any issues discovered.

**Step 6: Commit**

```bash
git add tests/real-libraries/freertos/FreeRTOSConfig.*
git commit -m "test: add FreeRTOSConfig.cnx for FreeRTOS interop (Issue #931)"
```

---

## Task 5: Create task-handle.test.cnx (Type Resolution)

**Files:**
- Create: `tests/real-libraries/freertos/task-handle.test.cnx`
- Create: `tests/real-libraries/freertos/task-handle.expected.c`
- Create: `tests/real-libraries/freertos/task-handle.expected.h`

**Step 1: Write the test**

Create `tests/real-libraries/freertos/task-handle.test.cnx`:

```c-next
// test-no-exec
// Tests: Can C-Next parse FreeRTOS typedefs and use handle types?
// Issue #931: Real-world library integration tests

#include "FreeRTOSConfig.cnx"
#include "FreeRTOS.h"
#include "task.h"

// Declare a task handle - tests opaque handle type resolution
TaskHandle_t globalTaskHandle;

void testFunction() {
    TaskHandle_t localHandle;
    // Just declare handles - no API calls yet
}
```

**Step 2: Run transpiler**

```bash
npx tsx src/index.ts tests/real-libraries/freertos/task-handle.test.cnx \
  --include tests/libs/FreeRTOS/include \
  --include tests/real-libraries/freertos
```

**Step 3: Analyze result**

If SUCCESS:
- Create expected files from output
- Run test suite to verify

If FAILURE:
- Document exact error in findings.md
- Analyze what's blocking (opaque types? typedef chains?)
- Decide: fix transpiler or document limitation

**Step 4: If test passes, commit**

```bash
git add tests/real-libraries/freertos/task-handle.*
git commit -m "test: add FreeRTOS TaskHandle_t type resolution test (Issue #931)"
```

**Step 5: Update findings.md**

Document whether type resolution works and any issues found.

---

## Task 6: Create task-create.test.cnx (void* Callback Test)

**Files:**
- Create: `tests/real-libraries/freertos/task-create.test.cnx`

**Step 1: Write the test (expected to fail)**

Create `tests/real-libraries/freertos/task-create.test.cnx`:

```c-next
// test-no-exec
// Tests: Can C-Next handle void* callback parameters in xTaskCreate?
// Issue #931: Real-world library integration tests
// Expected: This test will likely FAIL and trigger ADR research

#include "FreeRTOSConfig.cnx"
#include "FreeRTOS.h"
#include "task.h"

struct TaskData {
    u32 counter;
    u32 maxCount;
}

// Task function - FreeRTOS expects: void TaskFunction(void* pvParameters)
// C-Next doesn't have void* - what type should we use here?
// This is the core question for the void* interop ADR
void myTaskFunction(TaskData params) {
    params.counter <- params.counter + 1;
}

void createTask() {
    TaskData data <- {counter: 0, maxCount: 100};
    TaskHandle_t handle;

    // xTaskCreate signature:
    // BaseType_t xTaskCreate(
    //     TaskFunction_t pxTaskCode,      // void (*)(void*)
    //     const char* pcName,
    //     configSTACK_DEPTH_TYPE usStackDepth,
    //     void* pvParameters,             // <-- void* here
    //     UBaseType_t uxPriority,
    //     TaskHandle_t* pxCreatedTask
    // )

    // Attempt to call - this is where void* handling becomes critical
    xTaskCreate(myTaskFunction, "test", 128, data, 1, handle);
}
```

**Step 2: Run transpiler**

```bash
npx tsx src/index.ts tests/real-libraries/freertos/task-create.test.cnx \
  --include tests/libs/FreeRTOS/include \
  --include tests/real-libraries/freertos
```

**Step 3: Document the failure**

Expected failure modes:
- Callback signature mismatch (C-Next func vs void(*)(void*))
- void* parameter type error
- Type coercion failure

Update `findings.md` with exact error message.

**Step 4: Create void* interop ADR**

If blocked by void*, create `docs/decisions/adr-XXX-void-pointer-interop.md`:

```markdown
# ADR-XXX: void* Interoperability for C Libraries

**Status:** Research
**Created:** 2026-02-24
**Issue:** #931

## Context

When testing C-Next interop with FreeRTOS (Issue #931), we discovered that
C libraries commonly use `void*` for generic/opaque parameters. C-Next
intentionally does not support `void*` as it's memory-unsafe.

## Problem

FreeRTOS `xTaskCreate` expects:
- Callback: `void (*TaskFunction_t)(void* pvParameters)`
- Parameter: `void* pvParameters`

C-Next cannot directly express either of these.

## Error Encountered

[Paste exact transpiler error here]

## Research Questions

1. How do other safe languages handle C void* interop?
   - Rust: ?
   - Zig: ?
   - Ada: ?

2. What patterns exist in real embedded code?
   - FreeRTOS tasks
   - Callback registration
   - Event handlers

3. Possible approaches:
   - Type tracking through void* (transpiler infers type at call site)
   - Explicit opaque<T> annotation
   - Generic pointer type with safety constraints
   - Require wrapper functions in C

4. MISRA implications?

## Decision

[TBD after research]

## Consequences

[TBD]
```

**Step 5: Commit findings**

```bash
git add tests/real-libraries/freertos/
git add docs/decisions/adr-*-void-pointer-interop.md
git commit -m "research: document void* interop limitation, create ADR (Issue #931)"
```

---

## Task 7: Final Documentation

**Files:**
- Update: `tests/real-libraries/freertos/findings.md`
- Update: `tests/real-libraries/README.md`

**Step 1: Finalize findings.md**

Update with complete test results and discoveries.

**Step 2: Update GitHub issue**

```bash
gh issue comment 931 --body "Phase 1 complete. Findings:

- FreeRTOS-Kernel V11.2.0 vendored
- FreeRTOSConfig.cnx: [PASS/FAIL]
- TaskHandle_t resolution: [PASS/FAIL]
- xTaskCreate void* callback: [BLOCKED - ADR-XXX created]

See tests/real-libraries/freertos/findings.md for details.

Next steps depend on ADR-XXX void* interop decision."
```

**Step 3: Final commit**

```bash
git add tests/real-libraries/
git commit -m "docs: finalize Phase 1 real-library test findings (Issue #931)"
```

---

## Checkpoint Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Vendor FreeRTOS-Kernel | Yes |
| 2 | Create test infrastructure | Yes |
| 3 | Analyze config requirements | No (research) |
| 4 | FreeRTOSConfig.cnx | Yes |
| 5 | task-handle.test.cnx | Yes (if passes) |
| 6 | task-create.test.cnx | Yes (with ADR) |
| 7 | Final documentation | Yes |

## Exit Criteria

- FreeRTOS vendored and version-pinned
- At least FreeRTOSConfig.cnx working
- void* limitation documented in ADR
- Findings documented for future work
