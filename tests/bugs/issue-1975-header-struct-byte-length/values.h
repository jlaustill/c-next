#ifndef VALUES_H
#define VALUES_H
#include <stdint.h>

/* A function, and a variable, each named as a struct tag is: C keeps the
 * two apart, so `probe` and `tick` are values */
struct probe {
    uint32_t size;
};
static inline int32_t probe(int32_t x) {
    return x + 1;
}

struct tick {
    int32_t sec;
};
static struct tick tick = {7};
static inline int32_t tick_seconds(void) {
    return tick.sec;
}

#endif
