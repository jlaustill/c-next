/**
 * Stub C++ class declarations for testing constructor syntax
 * Issue #375: C++ constructor argument syntax
 */
#ifndef CONSTRUCTOR_STUBS_H
#define CONSTRUCTOR_STUBS_H

#include <stdint.h>

// Generic C++ class with constructor
struct Adafruit_MAX31856 {
    uint8_t _pin;
    Adafruit_MAX31856(uint8_t pin) : _pin(pin) {}
    Adafruit_MAX31856(uint8_t cs, uint8_t di, uint8_t _do, uint8_t clk) : _pin(cs) {}
};

// CAN bus types for template test
enum CAN_PORTS { CAN1, CAN2, CAN3 };

// Template class with constructor
template<int Port, int RxSize, int TxSize>
struct FlexCAN_T4 {
    uint8_t _bus;
    FlexCAN_T4(uint8_t bus) : _bus(bus) {}
};

#endif // CONSTRUCTOR_STUBS_H
