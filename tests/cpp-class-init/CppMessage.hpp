// Issue #503: C++ class with default constructor
// This simulates a C++ class that initializes its members via constructor
#pragma once

#include <stdint.h>

#ifdef __cplusplus
// C++ version with default constructor that initializes all members
class CppMessage {
public:
    uint16_t pgn;
    uint8_t sourceAddress;
    uint8_t priority;

    // Default constructor - initializes all members to safe values
    CppMessage() : pgn(0), sourceAddress(0), priority(6) {}
};
#else
// C version for GCC syntax checking (plain struct)
typedef struct {
    uint16_t pgn;
    uint8_t sourceAddress;
    uint8_t priority;
} CppMessage;
#endif
