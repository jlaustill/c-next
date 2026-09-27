#ifndef C_INTS_H
#define C_INTS_H
#include <stdint.h>

typedef int sensor_t;
typedef enum { C_RED, C_GREEN } c_color_t;
typedef struct {
    int v;
    uint32_t n;
} c_pair_t;

extern int cSigned;
extern uint32_t cU32;
extern sensor_t cSensor;
extern c_color_t cColor;
extern char cChar;
extern c_pair_t cs;
int cGetS(void);

#endif
