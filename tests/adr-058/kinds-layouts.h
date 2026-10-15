#ifndef KINDS_LAYOUTS_H
#define KINDS_LAYOUTS_H
#include <stdint.h>

typedef struct {
    uint32_t a;
    uint8_t b;
} KCfg;

typedef struct {
    int32_t i;
    char *p;
} KOdd;

typedef union {
    uint32_t a;
    uint8_t b[2];
} KUn;

typedef struct {
    uint32_t a : 3;
    uint32_t b : 5;
} KBF;

#endif
