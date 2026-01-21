/**
 * Stub C++ template declarations for testing template type parsing
 * Issue #291: C++ template syntax support
 */
#ifndef TEMPLATE_STUBS_H
#define TEMPLATE_STUBS_H

#include <cstdint>

// Generic template type stub with variadic parameters
// Supports = 0 initialization via constructor
template<typename... Args>
struct TemplateType {
    int dummy;
    TemplateType() : dummy(0) {}
    TemplateType(int) : dummy(0) {}  // Allow = 0 initialization
};

// Buffer with size parameters
template<int Size, int Align = 1>
struct Buffer {
    char data[Size];
    Buffer() {}
    Buffer(int) {}  // Allow = 0 initialization
};

// Array with element type and size
template<typename T, int N>
struct Array {
    T data[N];
    Array() {}
    Array(int) {}  // Allow = 0 initialization
};

// Container with single type parameter
template<typename T>
struct Container {
    T value;
    Container() {}
    Container(int) {}  // Allow = 0 initialization
};

// Vector-like container
template<typename T>
struct Vector {
    T* data;
    int size;
    Vector() : data(nullptr), size(0) {}
    Vector(int) : data(nullptr), size(0) {}  // Allow = 0 initialization
};

// Pair type for nested template testing
template<typename K, typename V>
struct Pair {
    K first;
    V second;
    Pair() {}
    Pair(int) {}  // Allow = 0 initialization
};

// Stub element type
struct Element {
    int value;
};

// Stub parameter types for multi-parameter templates
struct Param1 {};
struct Param2 {};
struct Param3 {};

#endif // TEMPLATE_STUBS_H
