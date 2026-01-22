#pragma once
#include <cstdint>

// Minimal C++ header to enable C++ mode
// This file declares SOME types, but NOT all that are used in the test
// The test uses undeclared external classes to reproduce Issue #314

// C++11 typed enum to ensure C++ mode detection
// (This triggers the requiresCpp14 check in the test runner)
enum TestMode : uint8_t {
    TEST_OFF = 0,
    TEST_ON = 1
};

// A declared class with static methods (for regression testing)
class DeclaredClass {
public:
    static void init();
    static int getValue();
};

// A declared namespace (for regression testing)
namespace DeclaredNS {
    void setup();
    int read();
}

// ============================================================================
// STUBS FOR EXTERNAL CLASSES
// ============================================================================
// Issue #314: These stubs enable GCC compilation validation.
// The fix (adding || isGlobalAccess to CodeGenerator.ts) ensures global.X.method()
// always uses :: syntax in C++ mode, regardless of whether X is declared.

class Serial {
public:
    static void begin(int baud);
    static void println(const char* msg);
};

class Wire {
public:
    static void begin();
    static void beginTransmission(int addr);
};

class SPI {
public:
    static void begin();
    static uint8_t transfer(uint8_t data);
};

class ExternalLib {
public:
    static void initialize();
    static int compute(int value);
};

class ExternalSensor {
public:
    static void calibrate();
};
