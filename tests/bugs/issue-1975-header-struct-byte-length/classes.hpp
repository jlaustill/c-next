#ifndef CLASSES_HPP
#define CLASSES_HPP
#include <stdint.h>

union Un {
    uint32_t a;
    uint8_t b[2];
};

struct Base {
    uint32_t q;
};

struct Der : Base {
    uint8_t x;
};

struct Bf {
    uint32_t a : 3;
    uint32_t b : 5;
};

struct Virt {
    virtual void go();
    uint8_t z;
};

#endif
