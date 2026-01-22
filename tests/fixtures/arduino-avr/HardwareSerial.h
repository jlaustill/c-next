#pragma once
#include <cstdint>
#include <cstddef>

/**
 * Minimal Arduino HardwareSerial stub for C-Next testing
 * This mirrors the actual Arduino pattern where Serial is an OBJECT INSTANCE,
 * not a class with static methods.
 *
 * Key pattern:
 *   class HardwareSerial { ... };
 *   extern HardwareSerial Serial;  // <-- Serial is an OBJECT INSTANCE
 *
 * This means Serial.begin() should generate "Serial.begin()" (member access),
 * NOT "Serial::begin()" (scope resolution).
 */

class HardwareSerial {
public:
    void begin(unsigned long baud);
    void end();
    size_t print(const char* str);
    size_t println(const char* str);
    size_t write(uint8_t byte);
    int available();
    int read();
};

// The key declaration: Serial is a GLOBAL OBJECT INSTANCE
// This is how Arduino actually declares it
extern HardwareSerial Serial;
extern HardwareSerial Serial1;
extern HardwareSerial Serial2;
extern HardwareSerial Serial3;
