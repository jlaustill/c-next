// Issue #834: Named struct tag (no typedef)
// In C, this requires 'struct' keyword when referencing the type

#ifndef NAMED_TAG_H
#define NAMED_TAG_H

#include <stdint.h>

struct my_type_t {
    int32_t value;
    int32_t extra;
};

void consume(const struct my_type_t *item);

#endif
