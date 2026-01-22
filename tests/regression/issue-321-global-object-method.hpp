#pragma once
#include <cstdint>
#include <cstddef>

/**
 * Issue #321: Test header for differentiating object instances vs classes
 *
 * This header mirrors the REAL Arduino pattern from ArduinoCore-avr/HardwareSerial.h:
 *   - HardwareSerial is a CLASS (non-static methods)
 *   - Serial is an OBJECT INSTANCE: "extern HardwareSerial Serial;"
 *
 * The real Arduino headers are available in tests/fixtures/arduino-avr/ for reference.
 * We use a simplified version here to ensure reliable C++ parsing.
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
// ARDUINO PATTERN: Class + extern object instance
// Mirrors real Arduino: tests/fixtures/arduino-avr/HardwareSerial.h:93-143
// ============================================================================
class HardwareSerial {
public:
    void begin(unsigned long baud);
    void end();
    size_t print(const char* str);
    size_t println(const char* str);
    int available();
    int read();
};

// THE KEY PATTERN: Serial is an OBJECT INSTANCE, not a class
// Real Arduino (line 143): extern HardwareSerial Serial;
extern HardwareSerial Serial;

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
