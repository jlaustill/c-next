/**
 * Third-party C header for #1544. The callback typedef takes a NON-CONST
 * pointer, which is what makes the defect observable: #268 auto-const and the
 * typedef then disagree visibly, where a by-value scalar parameter would emit
 * the same text on both sides and hide it.
 */

#ifndef SENSOR_API_H
#define SENSOR_API_H

#include <stdint.h>

typedef struct SensorReading {
    uint16_t value;
} SensorReading;

/* Non-const pointer parameter -- see the header comment above. */
typedef void (*ReadingHandler)(SensorReading *);

/* Inline so the fixture links without a separate C translation unit. */
static inline void register_reading_handler(ReadingHandler handler) {
    SensorReading reading;
    reading.value = 5;
    handler(&reading);
}

#endif /* SENSOR_API_H */
