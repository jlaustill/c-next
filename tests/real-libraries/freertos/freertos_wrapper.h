/*
 * FreeRTOS Wrapper - C Boundary Layer
 *
 * Per ADR-061: C is the escape hatch for void* and unsafe operations.
 * This wrapper provides typed interfaces that C-Next code can call safely.
 */

#ifndef FREERTOS_WRAPPER_H
#define FREERTOS_WRAPPER_H

#include <stdint.h>
#include <stdbool.h>

#include "FreeRTOSConfig.h"
#include "FreeRTOS.h"
#include "task.h"

/*
 * TaskData - Typed struct for task parameters
 * Defined here so both C wrapper and C-Next can use it.
 */
typedef struct {
    uint32_t counter;
    uint32_t maxCount;
    bool taskRan;
} TaskData;

/*
 * Typed task creation wrapper
 *
 * This function:
 * 1. Accepts typed TaskData* (not void*)
 * 2. Internally passes it as void* to xTaskCreate
 * 3. Provides a wrapper callback that casts back to TaskData*
 *
 * C-Next code calls this typed function instead of raw xTaskCreate.
 */
BaseType_t createTypedTask(
    const char* pcName,
    configSTACK_DEPTH_TYPE usStackDepth,
    TaskData* pxTaskData,
    UBaseType_t uxPriority,
    TaskHandle_t* pxCreatedTask
);

/*
 * Note: The typed task function (counterTask_typed) is declared in the
 * generated header from C-Next. The wrapper implementation includes that.
 */

#endif /* FREERTOS_WRAPPER_H */
