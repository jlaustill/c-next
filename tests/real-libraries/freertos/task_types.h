/*
 * Shared types for FreeRTOS integration test
 *
 * This header defines types used by both C-Next and C wrapper.
 * No function declarations - just data types.
 */

#ifndef TASK_TYPES_H
#define TASK_TYPES_H

#include <stdint.h>
#include <stdbool.h>

/*
 * TaskData - Typed struct for task parameters
 * Used by both C wrapper and C-Next code.
 */
typedef struct {
    uint32_t counter;
    uint32_t maxCount;
    bool taskRan;
} TaskData;

#endif /* TASK_TYPES_H */
