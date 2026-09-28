#ifndef BUF_SOURCE_H
#define BUF_SOURCE_H
#include <stdint.h>
static inline uint8_t *get_buf(void) {
    static uint8_t b[4] = {10U, 20U, 30U, 40U};
    return b;
}
#endif
