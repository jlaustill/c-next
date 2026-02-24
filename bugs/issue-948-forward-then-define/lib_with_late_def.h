#ifndef LIB_WITH_LATE_DEF_H
#define LIB_WITH_LATE_DEF_H
#include <stdint.h>

/* Forward declaration first (common in C libraries) */
typedef struct _point_t point_t;

/* Full definition comes later in the same header */
struct _point_t {
    int32_t x;
    int32_t y;
};

void point_init(point_t * p);

#endif
