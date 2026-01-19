// tests/functions/func-return-member-cpp.h
/**
 * C++ header for testing function return member passing
 * Issue #256: Extend struct member handling to function return patterns
 *
 * Uses C++ typed enums which are distinct from uint8_t.
 */

#ifndef FUNC_RETURN_MEMBER_CPP_H
#define FUNC_RETURN_MEMBER_CPP_H

#include <stdint.h>
#include <stdbool.h>

// Typed enums (C++ only) - distinct types from uint8_t
enum EMode : uint8_t {
    MODE_OFF = 0,
    MODE_ON = 1,
    MODE_AUTO = 2
};

// Struct with bool and typed enum members
typedef struct {
    bool enabled;
    EMode mode;
    uint8_t value;
} DeviceConfig;

#endif // FUNC_RETURN_MEMBER_CPP_H
