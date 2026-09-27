#ifndef FO_H
#define FO_H

#include <stdint.h>

typedef float real_t;
typedef float float32_t;

typedef struct {
    float cf;
} cpt_t;

typedef float (*getter_t)(void);

typedef struct {
    getter_t get;
} ops_t;

extern float scale;
extern uint32_t c_u;
extern int32_t c_s;
extern cpt_t c_pt;
extern ops_t c_ops;
float cGetF(void);

#endif
