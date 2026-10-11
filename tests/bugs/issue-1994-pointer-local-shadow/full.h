#ifndef FULL_H
#define FULL_H
#include <stdint.h>
typedef struct {
    int32_t x;
    int32_t y;
} Full;
static Full the_full = {1, 2};
static Full* full_get(void) {
    return &the_full;
}
#endif
