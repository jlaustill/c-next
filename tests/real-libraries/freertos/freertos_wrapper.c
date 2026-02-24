/*
 * FreeRTOS Wrapper - C Boundary Layer Implementation
 *
 * Per ADR-061: All void* casts happen here in C, not in C-Next.
 * This keeps C-Next code pure and type-safe.
 */

#include "freertos_wrapper.h"

/* Include the generated C-Next header for counterTask_typed declaration */
/* In a real build, this would be: #include "task-typed.test.h" */
/* For now, we forward-declare since the header is generated later */
extern void counterTask_typed(TaskData* data);

/*
 * Internal task wrapper - matches FreeRTOS TaskFunction_t signature
 *
 * This is where the void* cast happens:
 * 1. FreeRTOS calls this with void* pvParameters
 * 2. We cast it back to TaskData* (we know the type because we created it)
 * 3. We call the typed C-Next function
 */
static void counterTask_wrapper(void* pvParameters) {
    TaskData* data = (TaskData*)pvParameters;  /* Unsafe cast in C */
    counterTask_typed(data);                    /* Call typed C-Next function */
}

/*
 * Typed task creation wrapper
 *
 * C-Next calls this typed function. We handle the void* internally.
 */
BaseType_t createTypedTask(
    const char* pcName,
    configSTACK_DEPTH_TYPE usStackDepth,
    TaskData* pxTaskData,
    UBaseType_t uxPriority,
    TaskHandle_t* pxCreatedTask
) {
    return xTaskCreate(
        counterTask_wrapper,    /* Our wrapper, not the typed function */
        pcName,
        usStackDepth,
        (void*)pxTaskData,      /* Cast to void* here in C */
        uxPriority,
        pxCreatedTask
    );
}
