#pragma once
#include <stdint.h>

typedef struct Dev Dev;

static inline uint8_t dev_read(const Dev* d) {
    return d == 0 ? 1 : 2;
}
