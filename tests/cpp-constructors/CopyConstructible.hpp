// Test helper: C++ class with copy constructor
#pragma once

#ifdef __cplusplus
class CopyConstructible {
public:
    CopyConstructible() : id(0), data(0) {}
    CopyConstructible(const CopyConstructible& other) : id(other.id), data(other.data) {}  // Copy constructor
    int id;
    int data;
};
#else
// C version for syntax checking
typedef struct {
    int id;
    int data;
} CopyConstructible;
#endif
