// Test helper: C++ class with default constructor
#pragma once

#ifdef __cplusplus
class DefaultConstructible {
public:
    DefaultConstructible() : value(0), name(nullptr) {}  // User-defined constructor
    int value;
    const char* name;
};
#else
// C version for syntax checking
typedef struct {
    int value;
    const char* name;
} DefaultConstructible;
#endif
