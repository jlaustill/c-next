#ifndef STRUCT_LITERAL_CALLBACK_TYPES_H
#define STRUCT_LITERAL_CALLBACK_TYPES_H

#include <stdint.h>

typedef struct {
    uint32_t x;
    uint32_t y;
} VPt;

/* A callback that takes its struct by value */
typedef uint32_t (*vpt_cb_t)(VPt p);

static inline void set_vcb(vpt_cb_t cb) {
    (void)cb;
}

#endif
