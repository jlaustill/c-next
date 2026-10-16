#pragma once
#include <stdint.h>

class Counter {
public:
    uint8_t value;
    Counter() : value(0) {}
    void bump() { value++; }
    uint8_t get() const { return value; }
};
