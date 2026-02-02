// External C header with array field for Issue #612 test
#ifndef EXTERNAL_H
#define EXTERNAL_H

#include <stdint.h>

typedef struct ExternalStruct {
    uint8_t data[8];
    uint8_t count;
} ExternalStruct;

#endif
