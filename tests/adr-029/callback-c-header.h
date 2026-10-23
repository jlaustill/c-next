#ifndef CALLBACK_C_HEADER_H
#define CALLBACK_C_HEADER_H
#include <stdint.h>
uint32_t matchingClock(void);
uint64_t wideClock(void);
void voidClock(void);
uint32_t argClock(uint32_t n);
#endif
