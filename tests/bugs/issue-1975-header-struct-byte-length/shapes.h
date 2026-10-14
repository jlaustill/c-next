#ifndef SHAPES_H
#define SHAPES_H
#include <stdint.h>

typedef struct {
    uint32_t a;
    uint8_t b;
} Cfg;

typedef struct {
    Cfg inner;
    uint16_t arr[3];
    int32_t i;
} Outer;

typedef struct {
    int32_t i;
    char *p;
} Odd;

#endif
