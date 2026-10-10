#ifndef BYTE_SINK_H
#define BYTE_SINK_H
#include <stdint.h>
void send_u8(const uint8_t* p, uint32_t n);
void send_any(const void* p, uint32_t n);
#endif
