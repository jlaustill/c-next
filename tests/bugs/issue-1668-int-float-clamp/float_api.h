/* Helper (not a test): C declarations the #1668 foreign-operand fixture
 * combines with a C-Next integer. None of them is defined -- the fixture is a
 * test-error and never links. */
#ifndef FLOAT_API_H
#define FLOAT_API_H

#include <stdint.h>

typedef float float32_t;

typedef struct {
    float v;
    uint32_t count;
} ApiSample;

extern float apiScale;
extern float32_t apiScale32;
extern ApiSample apiSample;
extern uint32_t apiCount;

float apiHalf(void);

#endif
