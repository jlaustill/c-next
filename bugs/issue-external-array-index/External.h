// External C header with array field
#ifndef EXTERNAL_H
#define EXTERNAL_H

#include <stdint.h>

typedef struct ExternalStruct {
    uint8_t data[8];
    uint8_t count;
} ExternalStruct;

#endif
