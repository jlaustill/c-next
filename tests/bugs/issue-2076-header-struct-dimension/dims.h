#ifndef DIMS_H
#define DIMS_H
#include <stdint.h>

typedef struct {
    uint32_t a;
    uint8_t b;
} Cfg;

typedef struct {
    Cfg inner;
    uint16_t arr[3];
} Outer;

typedef struct {
    int32_t i;
    char *p;
} Odd;

#endif
