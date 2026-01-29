// External C configuration type for testing
// Simulates a hardware configuration struct from an external library
#pragma once

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint32_t baudRate;
    uint8_t dataBits;
    uint8_t stopBits;
    bool parityEnabled;
} ExternalSerialConfig;

typedef struct {
    uint16_t address;
    uint8_t channel;
    bool enabled;
} ExternalI2CConfig;
