#ifndef MULTI_TYPE_SAME_HEADER_H
#define MULTI_TYPE_SAME_HEADER_H
#include <stdint.h>

typedef struct {
    int16_t x;
    int16_t y;
} Point;

typedef struct {
    Point start;
    Point end;
} Line;

#endif
