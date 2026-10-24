#pragma once
#include <stdint.h>

typedef struct Dev Dev;

static inline uint8_t dev_write(Dev* d, uint8_t v) {
    return d ? 0 : v;
}
