#ifndef STATICS_HPP
#define STATICS_HPP
#include <stdint.h>

struct Dev {
    uint32_t reg;
    uint8_t id;
    static uint32_t make(uint32_t x) {
        return x + 1;
    }
    static const uint32_t LIMIT = 7;
};

struct Bits {
    uint32_t a : 3;
    uint32_t b : 5;
};

struct Pod {
    static int32_t total() {
        return 3;
    }
};

#endif
