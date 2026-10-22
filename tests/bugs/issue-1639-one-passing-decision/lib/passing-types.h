#ifndef PASSING_TYPES_H
#define PASSING_TYPES_H

#include <stdint.h>

/* A type cnx does not know: an external typedef */
typedef uint32_t ticks_t;

typedef struct {
    uint32_t x;
    uint32_t y;
} CPt;

/* A callback that takes its struct by value */
typedef uint32_t (*cpt_cb_t)(CPt p);

static inline void set_cpt_cb(cpt_cb_t cb) {
    (void)cb;
}

#endif
