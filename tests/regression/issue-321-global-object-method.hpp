#pragma once
#include <cstdint>
#include <cstddef>

/**
 * Issue #321: Test header for differentiating object instances vs classes
 *
 * This header declares:
 *   1. A CLASS with static methods (ConfigStorage) -> uses ::
 *   2. An OBJECT INSTANCE (via extern) (Serial from HardwareSerial.h) -> uses .
 *
 * The transpiler must distinguish between these and generate correct syntax.
 */

// C++11 typed enum to trigger C++ mode detection in test runner
enum Issue321TestMode : uint8_t {
    TEST_OFF = 0,
    TEST_ON = 1
};

// Include the Arduino-style Serial object instance
#include "../fixtures/arduino-avr/HardwareSerial.h"

// ============================================================================
// A CLASS with static methods - should use :: syntax
// ============================================================================
class ConfigStorage {
public:
    static void load();
    static void save();
    static int getValue(const char* key);
};

// ============================================================================
// A NAMESPACE - should use :: syntax
// ============================================================================
namespace SystemUtils {
    void initialize();
    int getStatus();
}

// ============================================================================
// Wire class stub - Arduino-style object instance pattern
// ============================================================================
class TwoWire {
public:
    void begin();
    void beginTransmission(uint8_t address);
    void endTransmission();
    uint8_t requestFrom(uint8_t address, uint8_t quantity);
    int available();
    int read();
    size_t write(uint8_t data);
};

// Wire is an OBJECT INSTANCE (like Serial)
extern TwoWire Wire;
