// Test helper for namespaced C++ class with constructor
#pragma once

namespace TestNS {
    class MyClass {
    public:
        MyClass() : id(0), data(nullptr) {}  // User-defined constructor
        int id;
        const char* data;
    };
}
