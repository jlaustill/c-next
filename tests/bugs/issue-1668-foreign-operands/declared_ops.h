#ifndef DECLARED_OPS_H
#define DECLARED_OPS_H
#include <stdint.h>
typedef struct {
    float (*getf)(void);
    uint8_t *buf;
    uint8_t arr[4];
    uint8_t flags;
} DeclaredOps;
extern DeclaredOps dops;
#endif
