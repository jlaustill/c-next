#ifndef PROP_H
#define PROP_H

#include <stdint.h>

typedef struct {
    double f;
} dbl_s;

/* Declared and defined here: each fixture is one translation unit. */
extern long gl;
long gl;
extern double gd;
double gd;
extern dbl_s gds;
dbl_s gds;
extern uint8_t gbuf[4];
uint8_t gbuf[4];

#endif
