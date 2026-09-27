#ifndef CF_H
#define CF_H

#include <stdint.h>

typedef struct {
    uint8_t flags;
    uint8_t bytes[2];
} cf_t;

#endif
