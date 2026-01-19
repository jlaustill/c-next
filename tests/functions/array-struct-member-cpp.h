// tests/functions/array-struct-member-cpp.h
/**
 * C++ header for testing array-of-structs member passing
 * Issue #256: Extend struct member handling to array patterns
 *
 * Uses C++ typed enums which are distinct from uint8_t.
 */

#ifndef ARRAY_STRUCT_MEMBER_CPP_H
#define ARRAY_STRUCT_MEMBER_CPP_H

#include <stdint.h>
#include <stdbool.h>

// Typed enums (C++ only) - distinct types from uint8_t
enum ESensorType : uint8_t {
    SENSOR_TEMP = 0,
    SENSOR_PRESSURE = 1,
    SENSOR_HUMIDITY = 2
};

enum EStatus : uint8_t {
    STATUS_OFF = 0,
    STATUS_ON = 1,
    STATUS_ERROR = 2
};

// Struct with bool and typed enum members
typedef struct {
    bool active;
    ESensorType sensorType;
    EStatus status;
    uint8_t value;
} SensorReading;

#endif // ARRAY_STRUCT_MEMBER_CPP_H
