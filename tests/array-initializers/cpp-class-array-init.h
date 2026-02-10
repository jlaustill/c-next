// C++ header with a class that has a constructor
// This triggers C++ syntax detection and makes isCppType() return true
#ifndef CPP_CLASS_ARRAY_INIT_H
#define CPP_CLASS_ARRAY_INIT_H

class CppTestClass {
public:
    CppTestClass() : value(0) {}
    int value;
};

#endif // CPP_CLASS_ARRAY_INIT_H
