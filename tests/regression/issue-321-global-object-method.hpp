#pragma once
#include <cstdint>
#include <cstddef>

/**
 * Issue #321: Test header for differentiating object instances vs classes
 *
 * This test verifies C-Next correctly handles:
 *   - Classes with static methods -> uses ::
 *   - Object instances (via extern) -> uses .
 *
 * For execution testing, we provide simple stub implementations.
 */

// C++11 typed enum to trigger C++ mode detection
enum Issue321TestMode : uint8_t {
    TEST_OFF = 0,
    TEST_ON = 1
};

// ============================================================================
// SIMULATED ARDUINO HardwareSerial PATTERN
// In real Arduino: class HardwareSerial { ... }; extern HardwareSerial Serial;
// ============================================================================
class HardwareSerial {
public:
    void begin(unsigned long baud) { (void)baud; }
    size_t println(const char* str) { (void)str; return 0; }
};

// Serial is an OBJECT INSTANCE (like in real Arduino)
inline HardwareSerial Serial;

// ============================================================================
// A CLASS with static methods - should use :: syntax
// ============================================================================
class ConfigStorage {
public:
    static void load() {}
    static void save() {}
    static int getValue(const char* key) { (void)key; return 0; }
};

// ============================================================================
// A NAMESPACE - should use :: syntax
// ============================================================================
namespace SystemUtils {
    inline void initialize() {}
    inline int getStatus() { return 0; }
}

// ============================================================================
// Wire class stub - Arduino-style object instance pattern
// ============================================================================
class TwoWire {
public:
    void begin() {}
    void beginTransmission(uint8_t address) { (void)address; }
};

// Wire is an OBJECT INSTANCE (like Serial)
inline TwoWire Wire;
