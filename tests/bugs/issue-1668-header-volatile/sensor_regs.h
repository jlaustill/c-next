#ifndef SENSOR_REGS_H
#define SENSOR_REGS_H
extern volatile float vf;
typedef volatile float vfloat_t;
extern vfloat_t tv;
typedef struct {
    volatile float level;
} sensor_t;
extern sensor_t hw;
extern float nf;
#endif
