/**
 * C++ header for testing rvalue argument handling in C++ mode
 * Issue #250: Compound literals are not addressable lvalues in C++
 *
 * The typed enum forces C++14 mode detection in the test framework.
 */

#ifndef RVALUE_ARG_CPP_H
#define RVALUE_ARG_CPP_H

#include <stdint.h>

// Typed enum forces C++ compilation
enum EMode : uint8_t {
    MODE_OFF = 0,
    MODE_ON = 1
};

#endif // RVALUE_ARG_CPP_H
