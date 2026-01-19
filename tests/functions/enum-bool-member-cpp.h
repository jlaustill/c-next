// tests/functions/enum-bool-member-cpp.h
/**
 * C++ header for testing enum/bool struct member passing
 * Issue #252: enum and bool types not converted when passed to u8
 *
 * Uses C++ typed enums which are distinct from uint8_t.
 */

#ifndef ENUM_BOOL_MEMBER_CPP_H
#define ENUM_BOOL_MEMBER_CPP_H

#include <stdint.h>
#include <stdbool.h>

// Typed enums (C++ only) - distinct types from uint8_t
enum EPressureType : uint8_t {
    PRESSURE_NONE = 0,
    PRESSURE_LOW = 1,
    PRESSURE_HIGH = 2
};

enum EThermocoupleType : uint8_t {
    TC_TYPE_K = 0,
    TC_TYPE_J = 1,
    TC_TYPE_T = 2
};

// Struct with bool and typed enum members
typedef struct {
    bool enabled;
    EPressureType pressureType;
    EThermocoupleType thermocoupleType;
    uint8_t value;
} SensorConfig;

#endif // ENUM_BOOL_MEMBER_CPP_H
