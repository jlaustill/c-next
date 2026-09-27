#ifndef WIDE_H
#define WIDE_H

#include <stdint.h>

typedef struct {
    uint64_t big;
    uint8_t small;
} wide_s;

/* Declared and defined here: each fixture is one translation unit. */
extern uint64_t gbig;
uint64_t gbig;
extern uint8_t gbuf[4];
uint8_t gbuf[4];
extern wide_s gws;
wide_s gws;

#endif
