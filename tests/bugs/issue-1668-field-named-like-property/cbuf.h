#ifndef CBUF_H
#define CBUF_H
#include <stdint.h>
typedef struct {
    uint32_t size;
    uint32_t length;
} cbuf_t;
static cbuf_t cbuf = {5U, 6U};
#endif
