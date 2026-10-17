#ifndef SCALAR_CB_H
#define SCALAR_CB_H

#include <stdint.h>

typedef uint32_t (*u32p_cb_t)(const uint32_t* v);

static inline void set_ucb(u32p_cb_t cb) {
    (void)cb;
}

#endif
