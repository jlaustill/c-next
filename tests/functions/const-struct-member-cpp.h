// tests/functions/const-struct-member-cpp.h
/**
 * C++ header for testing const struct member passing
 * Issue #251: const correctness when passing struct members
 *
 * The typed enum forces C++14 mode detection.
 */

#ifndef CONST_STRUCT_MEMBER_CPP_H
#define CONST_STRUCT_MEMBER_CPP_H

#include <stdint.h>

// Typed enum forces C++ compilation
enum EMode : uint8_t {
    MODE_OFF = 0,
    MODE_ON = 1
};

// Struct with basic members
typedef struct {
    uint8_t value;
    uint8_t flags;
} TestConfig;

#endif // CONST_STRUCT_MEMBER_CPP_H
