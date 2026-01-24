#ifndef MOCK_DEVICE_H
#define MOCK_DEVICE_H

#include <stdint.h>

class MockDevice {
public:
    bool begin(uint8_t addr) { return true; }
};

#endif
