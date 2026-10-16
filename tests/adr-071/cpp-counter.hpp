#pragma once
#include <stdint.h>

class Counter {
public:
    uint8_t value;
    Counter() : value(0) {}
    Counter(uint8_t start) : value(start) {}
    void bump() { value++; }
    uint8_t get() const { return value; }
};
