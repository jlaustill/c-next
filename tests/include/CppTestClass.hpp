// Test helper for Issue #517: C++ class struct init
// This is a C++ class with a user-defined constructor (NOT an aggregate type)
#pragma once

#ifdef __cplusplus
class CppTestClass {
public:
    CppTestClass() : value(0), name(nullptr) {}  // User-defined constructor
    int value;
    const char* name;
};
#else
// C version for GCC syntax checking
typedef struct {
    int value;
    const char* name;
} CppTestClass;
#endif
