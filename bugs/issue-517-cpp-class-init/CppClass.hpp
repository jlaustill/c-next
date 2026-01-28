// Simulates a C++ class with a user-defined constructor
// This is NOT an aggregate type - designated initializers don't work

class CppClass {
public:
    CppClass() : value(0) {}  // User-defined constructor makes it non-aggregate
    int value;
};
