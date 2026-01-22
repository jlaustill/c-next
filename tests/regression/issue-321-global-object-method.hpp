#pragma once
#include <cstdint>
#include <cstddef>

// Include AVR io.h shim to define UBRR0H (enables extern HardwareSerial Serial)
#include <avr/io.h>

/**
 * Issue #321: Test header for differentiating object instances vs classes
 *
 * This test uses the REAL Arduino headers from ArduinoCore-avr to verify
 * that C-Next correctly handles the Arduino pattern:
 *   - HardwareSerial is a CLASS (non-static instance methods)
 *   - Serial is an OBJECT INSTANCE: "extern HardwareSerial Serial;"
 *
 * Key distinction being tested:
 *   1. A CLASS with static methods (ConfigStorage) -> uses ::
 *   2. An OBJECT INSTANCE (via extern) (Serial) -> uses .
 */

// C++11 typed enum to trigger C++ mode detection in test runner
enum Issue321TestMode : uint8_t {
    TEST_OFF = 0,
    TEST_ON = 1
};

// ============================================================================
// REAL ARDUINO HEADERS
// This includes the actual ArduinoCore-avr HardwareSerial.h which declares:
//   class HardwareSerial : public Stream { ... };
//   extern HardwareSerial Serial;  // Object INSTANCE
// ============================================================================
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
