#ifndef COUNTER_H
#define COUNTER_H
#include <stdint.h>
typedef struct {
    uint32_t total;
} Tally;
static inline void bump(uint32_t* x) {
    *x = *x + 1U;
}
static inline void add_to(Tally* t, uint32_t n) {
    t->total = t->total + n;
}
static inline uint32_t sum_all(const uint32_t* p, uint32_t n) {
    uint32_t total = 0U;
    for (uint32_t i = 0U; i < n; i++) {
        total += p[i];
    }
    return total;
}
#endif
