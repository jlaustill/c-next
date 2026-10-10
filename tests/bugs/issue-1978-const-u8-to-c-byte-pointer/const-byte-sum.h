#ifndef CONST_BYTE_SUM_H
#define CONST_BYTE_SUM_H
#include <stdint.h>
static inline uint32_t sum_u8(const uint8_t* p, uint32_t n) {
    uint32_t total = 0U;
    for (uint32_t i = 0U; i < n; i++) {
        total += p[i];
    }
    return total;
}
#endif
