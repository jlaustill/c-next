#ifndef CALLBACK_C_HEADER_PARAMS_H
#define CALLBACK_C_HEADER_PARAMS_H
#include <stdint.h>
#include <stdbool.h>
typedef struct Sample {
    int32_t value;
} Sample;
void onValue(uint32_t v);
void onMut(uint32_t *v);
void onSample(const Sample *s);
void onMutSample(Sample *s);
void onBytes(const uint8_t bytes[4]);
void onText(const char *text);
float onMix(double d, bool b, int8_t i);
#endif
